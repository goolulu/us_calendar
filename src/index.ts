import { bundledIndexDataset, indexSourceStatuses, type IndexDataset } from "./constituents";
import {
  buildEarningsEvents,
  EARNINGS_KV_KEYS,
  earningsSourceStatus,
  loadEarningsRanges,
} from "./earnings";
import { fallbackAdp, fallbackFomc, fallbackReleases, generateClaims } from "./generated";
import { createIcs } from "./ics";
import { managementPage } from "./page";
import { parseAdp, parseBea, parseBls, parseFomc } from "./parsers";
import {
  buildStockCatalog,
  filterEventsForStocks,
  filterIcsForStocks,
  icsEventCount,
  requestedStocks,
} from "./subscriptions";
import type { CalendarEvent, SourceStatus, ValueStatus } from "./types";
import { enrichEventsWithFmp } from "./values";

const HEADERS = { "user-agent": "US-Economic-Calendar/1.0 (+calendar subscription)" };
const SIX_HOURS = 21_600;

export interface BuildResult {
  events: CalendarEvent[];
  sources: SourceStatus[];
  values: ValueStatus;
  generatedAt: string;
}

export interface BuildOptions {
  fmpApiKey?: string;
  earningsKv?: KVNamespace;
}

export interface Env {
  EARNINGS_DATA?: KVNamespace;
  FMP_API_KEY?: string;
}

interface CalendarMetadata {
  generatedAt: string;
  events: number;
  fallbackSources: string[];
  values?: Pick<ValueStatus, "state" | "metrics">;
}

interface HealthSnapshot {
  ok: boolean;
  generatedAt: string;
  events: number;
  sources: SourceStatus[];
  values: ValueStatus;
}

interface StockCatalogResponse {
  version: 1;
  source: "kv" | "bundled";
  updatedAt: string;
  counts: { unique: number; sp500: number; nasdaq100: number };
  stocks: ReturnType<typeof buildStockCatalog>;
}

async function getText(url: string): Promise<string> {
  const response = await fetch(url, { headers: HEADERS, cf: { cacheEverything: true, cacheTtl: SIX_HOURS } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function mergeById(fallback: CalendarEvent[], live: CalendarEvent[]): CalendarEvent[] {
  const merged = new Map(fallback.map((event) => [event.id, event]));
  for (const event of live) merged.set(event.id, event);
  return [...merged.values()];
}

function inWindow(events: CalendarEvent[], now: Date): CalendarEvent[] {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 90)).toISOString().slice(0, 10);
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 15, now.getUTCDate())).toISOString().slice(0, 10);
  return events.filter((event) => event.start.slice(0, 10) >= from && event.start.slice(0, 10) <= until);
}

async function earningsData(kv: KVNamespace, now: Date): Promise<{
  indices: IndexDataset;
  past: Awaited<ReturnType<typeof loadEarningsRanges>>["past"];
  future: Awaited<ReturnType<typeof loadEarningsRanges>>["future"];
}> {
  const [storedIndices, ranges] = await Promise.all([
    kv.get<IndexDataset>(EARNINGS_KV_KEYS.indices, "json").catch(() => null),
    loadEarningsRanges(kv).catch(() => ({ past: null, future: null })),
  ]);
  return { indices: storedIndices ?? bundledIndexDataset(now), ...ranges };
}

function constituentStatuses(indices: IndexDataset, now: Date): SourceStatus[] {
  const stale = now.getTime() - new Date(indices.updatedAt).getTime() > 8 * 86_400_000;
  return indexSourceStatuses(indices).map((source) => ({
    ...source,
    state: stale ? "fallback" : source.state,
    updatedAt: indices.updatedAt,
    ...(stale ? { detail: `${source.detail}; constituent snapshot is older than eight days` } : {}),
  }));
}

export async function buildEvents(now: Date, options: BuildOptions = {}): Promise<BuildResult> {
  const currentYear = now.getUTCFullYear();
  const years = [currentYear, currentYear + 1];
  const results = await Promise.allSettled([
    ...years.map((year) => getText(`https://www.bls.gov/schedule/${year}/home.htm`)),
    getText("https://www.bea.gov/news/schedule/"),
    getText("https://adpemploymentreport.com/"),
    getText("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"),
  ]);
  const sources: SourceStatus[] = [];
  const fallback = fallbackReleases();
  const events: CalendarEvent[] = [];

  const blsLive: CalendarEvent[] = [];
  const unavailableBlsYears: number[] = [];
  for (let index = 0; index < years.length; index++) {
    const result = results[index];
    if (result.status === "fulfilled") blsLive.push(...parseBls(result.value));
    else unavailableBlsYears.push(years[index]);
  }
  const blsFallback = fallback.filter((event) => ["cpi", "ppi", "nfp"].includes(event.category));
  const blsEvents = mergeById(blsFallback, blsLive);
  events.push(...blsEvents);
  sources.push({
    source: "bls",
    state: blsLive.length ? "ok" : blsFallback.length ? "fallback" : "unavailable",
    events: blsEvents.length,
    ...(unavailableBlsYears.length ? { detail: `No published/reachable schedule for ${unavailableBlsYears.join(", ")}` } : {}),
  });

  const beaResult = results[years.length];
  const beaLive = beaResult.status === "fulfilled" ? parseBea(beaResult.value) : [];
  const beaFallback = fallback.filter((event) => event.category === "pce");
  const beaEvents = mergeById(beaFallback, beaLive);
  events.push(...beaEvents);
  sources.push({ source: "bea", state: beaLive.length ? "ok" : beaFallback.length ? "fallback" : "unavailable", events: beaEvents.length, ...(!beaLive.length ? { detail: "Using verified local schedule" } : {}) });

  const adpResult = results[years.length + 1];
  const adpLive = adpResult.status === "fulfilled" ? parseAdp(adpResult.value, currentYear) : [];
  const adpFallback = years.flatMap(fallbackAdp);
  const adpEvents = mergeById(adpFallback, adpLive);
  events.push(...adpEvents);
  sources.push({ source: "adp", state: adpLive.length ? "ok" : adpFallback.length ? "fallback" : "unavailable", events: adpEvents.length, ...(!adpLive.length ? { detail: "Using verified local schedule" } : {}) });

  const claims = generateClaims(now);
  events.push(...claims);
  sources.push({ source: "dol", state: "ok", events: claims.length, detail: "Weekly rule with federal-holiday adjustment" });

  const fomcResult = results[years.length + 2];
  const fomcLive = fomcResult.status === "fulfilled" ? parseFomc(fomcResult.value, years) : [];
  const fomcFallback = fallbackFomc(years);
  const fomcEvents = mergeById(fomcFallback, fomcLive);
  events.push(...fomcEvents);
  sources.push({ source: "fomc", state: fomcLive.length ? "ok" : fomcFallback.length ? "fallback" : "unavailable", events: fomcEvents.length, ...(!fomcLive.length ? { detail: "Using verified local schedule" } : {}) });

  if (options.earningsKv) {
    const { indices, past, future } = await earningsData(options.earningsKv, now);
    const earningsEvents = buildEarningsEvents(past, future, indices, now);
    events.push(...earningsEvents);
    sources.push(...constituentStatuses(indices, now));
    sources.push(earningsSourceStatus(past, future, earningsEvents.length, now));
  }

  const valueResult = await enrichEventsWithFmp(inWindow(events, now), options.fmpApiKey);
  return { events: valueResult.events, sources, values: valueResult.status, generatedAt: now.toISOString() };
}

function metadataFor(result: BuildResult): CalendarMetadata {
  return {
    generatedAt: result.generatedAt,
    events: result.events.length,
    fallbackSources: result.sources.filter((source) => source.state !== "ok").map((source) => source.source),
    values: { state: result.values.state, metrics: result.values.metrics },
  };
}

function calendarHeaders(metadata: CalendarMetadata, selection: ReadonlySet<string> | null = null): HeadersInit {
  return {
    "content-type": "text/calendar; charset=utf-8",
    "content-disposition": "inline; filename=us-economic-and-earnings-calendar.ics",
    "cache-control": `public, max-age=900, s-maxage=${SIX_HOURS}, stale-if-error=86400`,
    "x-calendar-events": String(metadata.events),
    ...(metadata.values ? {
      "x-calendar-value-source": metadata.values.state,
      "x-calendar-value-metrics": String(metadata.values.metrics),
    } : {}),
    ...(metadata.fallbackSources.length ? { "x-calendar-fallback": metadata.fallbackSources.join(",") } : {}),
    ...(selection !== null ? { "x-calendar-selected-stocks": String(selection.size) } : {}),
  };
}

function buildOptions(env: Env): BuildOptions {
  return { fmpApiKey: env.FMP_API_KEY, earningsKv: env.EARNINGS_DATA };
}

async function calendarResponse(
  now: Date,
  env: Env = {},
  selection: ReadonlySet<string> | null = null,
): Promise<Response> {
  const result = await buildEvents(now, buildOptions(env));
  const events = filterEventsForStocks(result.events, selection);
  if (!events.length) return Response.json({ error: "No calendar events available", sources: result.sources }, { status: 503 });
  const metadata = metadataFor({ ...result, events });
  if (selection !== null) {
    console.info("[calendar] built personalized fallback feed", {
      selectedStocks: selection.size,
      events: events.length,
    });
  }
  return new Response(createIcs(events, now), { headers: calendarHeaders(metadata, selection) });
}

export async function rebuildSnapshot(env: Env, now = new Date()): Promise<HealthSnapshot> {
  if (!env.EARNINGS_DATA) throw new Error("EARNINGS_DATA KV binding is required");
  const result = await buildEvents(now, buildOptions(env));
  if (!result.events.length) throw new Error("No calendar events available");
  const earningsStatus = result.sources.find((source) => source.source === "nasdaq-earnings");
  const health: HealthSnapshot = {
    ok: earningsStatus?.state === "ok" && result.sources.some((source) => source.state === "ok"),
    generatedAt: result.generatedAt,
    events: result.events.length,
    sources: result.sources,
    values: result.values,
  };
  const metadata = metadataFor(result);
  await env.EARNINGS_DATA.put(EARNINGS_KV_KEYS.calendar, createIcs(result.events, now), { metadata });
  await env.EARNINGS_DATA.put(EARNINGS_KV_KEYS.calendarEvents, JSON.stringify(result.events), { metadata });
  await env.EARNINGS_DATA.put(EARNINGS_KV_KEYS.health, JSON.stringify(health));
  return health;
}

async function storedCalendarResponse(
  kv: KVNamespace,
  selection: ReadonlySet<string> | null,
): Promise<Response | undefined> {
  if (selection !== null) {
    try {
      const storedEvents = await kv.getWithMetadata<CalendarEvent[], CalendarMetadata>(
        EARNINGS_KV_KEYS.calendarEvents,
        "json",
      );
      if (storedEvents.value && storedEvents.metadata) {
        const events = filterEventsForStocks(storedEvents.value, selection);
        const metadata = { ...storedEvents.metadata, events: events.length };
        const generatedAt = new Date(metadata.generatedAt);
        const stamp = Number.isNaN(generatedAt.getTime()) ? new Date() : generatedAt;
        console.info("[calendar] served personalized KV snapshot", {
          selectedStocks: selection.size,
          events: events.length,
        });
        return new Response(createIcs(events, stamp), { headers: calendarHeaders(metadata, selection) });
      }
    } catch (error) {
      console.warn("[calendar] structured KV snapshot unavailable; trying ICS snapshot", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    const stored = await kv.getWithMetadata<CalendarMetadata>(EARNINGS_KV_KEYS.calendar, "text");
    if (!stored.value || !stored.metadata) return undefined;
    const value = filterIcsForStocks(stored.value, selection);
    const metadata = selection === null ? stored.metadata : { ...stored.metadata, events: icsEventCount(value) };
    if (selection !== null) {
      console.info("[calendar] served personalized legacy ICS snapshot", {
        selectedStocks: selection.size,
        events: metadata.events,
      });
    }
    return new Response(value, { headers: calendarHeaders(metadata, selection) });
  } catch (error) {
    console.warn("[calendar] KV calendar snapshot read failed; building fallback", {
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

async function stockCatalogResponse(env: Env, now: Date): Promise<Response> {
  let indices: IndexDataset | null = null;
  let source: StockCatalogResponse["source"] = "bundled";
  if (env.EARNINGS_DATA) {
    try {
      indices = await env.EARNINGS_DATA.get<IndexDataset>(EARNINGS_KV_KEYS.indices, "json");
      if (indices) source = "kv";
    } catch (error) {
      console.warn("[stocks] KV constituent read failed; using bundled catalog", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  indices ??= bundledIndexDataset(now);
  const stocks = buildStockCatalog(indices);
  const body: StockCatalogResponse = {
    version: 1,
    source,
    updatedAt: indices.updatedAt,
    counts: {
      unique: stocks.length,
      sp500: indices.sp500.length,
      nasdaq100: indices.nasdaq100.length,
    },
    stocks,
  };
  return Response.json(body, {
    headers: { "cache-control": "public, max-age=900, s-maxage=3600, stale-if-error=86400" },
  });
}

function pageResponse(): Response {
  return new Response(managementPage(), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=900",
      "content-security-policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}

function withoutBody(response: Response): Response {
  return new Response(null, { status: response.status, headers: response.headers });
}

async function healthResponse(env: Env, now: Date): Promise<Response> {
  const stored = env.EARNINGS_DATA
    ? await env.EARNINGS_DATA.get<HealthSnapshot>(EARNINGS_KV_KEYS.health, "json").catch(() => null)
    : null;
  if (stored) {
    const stale = now.getTime() - new Date(stored.generatedAt).getTime() > 18 * 3_600_000;
    const body: HealthSnapshot = stale
      ? {
          ...stored,
          ok: false,
          sources: stored.sources.map((source) => source.source === "nasdaq-earnings"
            ? { ...source, state: source.state === "unavailable" ? "unavailable" : "fallback", detail: `${source.detail ? `${source.detail}; ` : ""}calendar snapshot is older than 18 hours` }
            : source),
        }
      : stored;
    return Response.json(body, { status: body.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
  }

  const result = await buildEvents(now, buildOptions(env));
  const earningsStatus = result.sources.find((source) => source.source === "nasdaq-earnings");
  const ok = result.events.length > 0
    && (!earningsStatus || earningsStatus.state === "ok")
    && result.sources.some((source) => source.state === "ok");
  return Response.json(
    { ok, generatedAt: result.generatedAt, events: result.events.length, sources: result.sources, values: result.values },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    const now = new Date();
    let response: Response;
    if (url.pathname === "/") {
      response = pageResponse();
    } else if (url.pathname === "/api/stocks") {
      response = await stockCatalogResponse(env, now);
    } else if (url.pathname === "/health") {
      response = await healthResponse(env, now);
    } else if (url.pathname === "/calendar.ics") {
      const selection = requestedStocks(url);
      response = env.EARNINGS_DATA
        ? await storedCalendarResponse(env.EARNINGS_DATA, selection) ?? await calendarResponse(now, env, selection)
        : await calendarResponse(now, env, selection);
    } else {
      response = new Response("Not found", { status: 404 });
    }
    return request.method === "HEAD" ? withoutBody(response) : response;
  },
} satisfies ExportedHandler<Env>;
