import { fallbackAdp, fallbackFomc, fallbackReleases, generateClaims } from "./generated";
import { createIcs } from "./ics";
import { parseAdp, parseBea, parseBls, parseFomc } from "./parsers";
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
}

interface Env {
  FMP_API_KEY?: string;
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

  const valueResult = await enrichEventsWithFmp(inWindow(events, now), options.fmpApiKey);
  return { events: valueResult.events, sources, values: valueResult.status, generatedAt: now.toISOString() };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function page(url: URL): string {
  const httpsUrl = `${url.origin}/calendar.ics`;
  const webcalUrl = `webcal://${url.host}/calendar.ics`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>美国经济日历</title><style>body{font:16px/1.65 system-ui,-apple-system,sans-serif;max-width:720px;margin:10vh auto;padding:0 24px;color:#172033;background:#f7f9fc}.card{background:white;padding:32px;border-radius:18px;box-shadow:0 8px 36px #17203312}h1{line-height:1.2}.button{display:inline-block;background:#1769e0;color:white;text-decoration:none;padding:12px 20px;border-radius:10px}code{display:block;overflow-wrap:anywhere;background:#f0f3f8;padding:10px;border-radius:8px;color:#465064}small{color:#657085}</style></head><body><main class="card"><h1>美国重要经济数据日历</h1><p>包含 CPI、PPI、PCE、ADP 小非农、非农就业 NFP、初请/续请失业金人数及 FOMC 利率决议。</p><p><a class="button" href="${escapeHtml(webcalUrl)}">在 iPhone 中订阅</a></p><p>也可以在“设置 → 日历 → 日历账户 → 添加已订阅的日历”中粘贴：</p><code>${escapeHtml(httpsUrl)}</code><small>时间按美国东部时间发布，iOS 会自动换算为本地时间。日程来自官方来源，可选显示前值和实际值，每 6 小时刷新。</small></main></body></html>`;
}

async function calendarResponse(now: Date, env: Env): Promise<Response> {
  const result = await buildEvents(now, { fmpApiKey: env.FMP_API_KEY });
  if (!result.events.length) return Response.json({ error: "No calendar events available", sources: result.sources }, { status: 503 });
  const fallbackSources = result.sources.filter((source) => source.state !== "ok").map((source) => source.source);
  return new Response(createIcs(result.events, now), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": "inline; filename=us-economic-calendar.ics",
      "cache-control": `public, max-age=900, s-maxage=${SIX_HOURS}, stale-if-error=86400`,
      "x-calendar-events": String(result.events.length),
      "x-calendar-value-source": result.values.state,
      "x-calendar-value-metrics": String(result.values.metrics),
      ...(fallbackSources.length ? { "x-calendar-fallback": fallbackSources.join(",") } : {}),
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    if (url.pathname === "/") return new Response(page(url), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
    if (url.pathname === "/health") {
      const result = await buildEvents(new Date(), { fmpApiKey: env.FMP_API_KEY });
      const ok = result.events.length > 0 && result.sources.some((source) => source.state === "ok");
      return Response.json({ ok, generatedAt: result.generatedAt, events: result.events.length, sources: result.sources, values: result.values }, { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } });
    }
    if (url.pathname !== "/calendar.ics") return new Response("Not found", { status: 404 });

    const cache = (caches as CacheStorage & { default: Cache }).default;
    const cacheKey = new Request(`${url.origin}/calendar.ics`, { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) return request.method === "HEAD" ? new Response(null, { status: cached.status, headers: cached.headers }) : cached;
    const response = await calendarResponse(new Date(), env);
    if (response.ok) ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return request.method === "HEAD" ? new Response(null, { status: response.status, headers: response.headers }) : response;
  },
} satisfies ExportedHandler<Env>;
