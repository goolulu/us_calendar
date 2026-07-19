import type { CalendarEvent, Category, EconomicMetric, ValueStatus } from "./types";

const FMP_URL = "https://financialmodelingprep.com/stable/economic-calendar";
const CACHE_SECONDS = 21_600;
const CHUNK_DAYS = 90;

interface FmpCalendarEvent {
  date?: unknown;
  country?: unknown;
  event?: unknown;
  previous?: unknown;
  actual?: unknown;
  unit?: unknown;
}

export interface NormalizedValueRecord {
  date: string; // America/New_York date, YYYY-MM-DD
  event: string;
  previous?: string;
  actual?: string;
  unit?: string;
}

interface MetricRule {
  key: string;
  label: string;
  patterns: RegExp[];
  excludes?: RegExp[];
}

interface ProviderResult {
  records: NormalizedValueRecord[];
  state: "ok" | "unavailable";
  detail?: string;
}

export interface EnrichmentResult {
  events: CalendarEvent[];
  status: ValueStatus;
}

const MOM = String.raw`(?:m\/?m|mom|month(?:ly)?(?:\s+over\s+month)?)`;
const YOY = String.raw`(?:y\/?y|yoy|year(?:ly)?(?:\s+over\s+year)?)`;

const RULES: Record<Category, MetricRule[]> = {
  cpi: [
    { key: "core-cpi-yoy", label: "核心 CPI 同比", patterns: [new RegExp(String.raw`\b(?:core\s+cpi|core\s+consumer\s+price\s+index)\b.*\b${YOY}\b`, "i")] },
    { key: "core-cpi-mom", label: "核心 CPI 环比", patterns: [new RegExp(String.raw`\b(?:core\s+cpi|core\s+consumer\s+price\s+index)\b.*\b${MOM}\b`, "i")] },
    { key: "cpi-yoy", label: "CPI 同比", patterns: [new RegExp(String.raw`\b(?:cpi|consumer\s+price\s+index)\b.*\b${YOY}\b`, "i")], excludes: [/\bcore\b/i] },
    { key: "cpi-mom", label: "CPI 环比", patterns: [new RegExp(String.raw`\b(?:cpi|consumer\s+price\s+index)\b.*\b${MOM}\b`, "i")], excludes: [/\bcore\b/i] },
  ],
  ppi: [
    { key: "core-ppi-yoy", label: "核心 PPI 同比", patterns: [new RegExp(String.raw`\b(?:core\s+ppi|core\s+producer\s+price\s+index)\b.*\b${YOY}\b`, "i")] },
    { key: "core-ppi-mom", label: "核心 PPI 环比", patterns: [new RegExp(String.raw`\b(?:core\s+ppi|core\s+producer\s+price\s+index)\b.*\b${MOM}\b`, "i")] },
    { key: "ppi-yoy", label: "PPI 同比", patterns: [new RegExp(String.raw`\b(?:ppi|producer\s+price\s+index)\b.*\b${YOY}\b`, "i")], excludes: [/\bcore\b/i] },
    { key: "ppi-mom", label: "PPI 环比", patterns: [new RegExp(String.raw`\b(?:ppi|producer\s+price\s+index)\b.*\b${MOM}\b`, "i")], excludes: [/\bcore\b/i] },
  ],
  pce: [
    { key: "core-pce-yoy", label: "核心 PCE 同比", patterns: [new RegExp(String.raw`\bcore\s+pce(?:\s+price\s+index)?\b.*\b${YOY}\b`, "i")] },
    { key: "core-pce-mom", label: "核心 PCE 环比", patterns: [new RegExp(String.raw`\bcore\s+pce(?:\s+price\s+index)?\b.*\b${MOM}\b`, "i")] },
    { key: "pce-yoy", label: "PCE 同比", patterns: [new RegExp(String.raw`\bpce(?:\s+price\s+index)?\b.*\b${YOY}\b`, "i")], excludes: [/\bcore\b/i] },
    { key: "pce-mom", label: "PCE 环比", patterns: [new RegExp(String.raw`\bpce(?:\s+price\s+index)?\b.*\b${MOM}\b`, "i")], excludes: [/\bcore\b/i] },
  ],
  nfp: [
    { key: "nonfarm-payrolls", label: "新增非农就业", patterns: [/\bnon[ -]?farm\s+payrolls?\b/i], excludes: [/\bprivate\b|\bgovernment\b/i] },
    { key: "unemployment-rate", label: "失业率", patterns: [/\bunemployment\s+rate\b/i] },
    { key: "average-hourly-earnings-mom", label: "平均时薪环比", patterns: [new RegExp(String.raw`\baverage\s+hourly\s+earnings\b.*\b${MOM}\b`, "i")] },
  ],
  adp: [
    { key: "adp-employment-change", label: "ADP 新增就业", patterns: [/\badp\b.*\b(?:employment|payrolls?)\b/i] },
  ],
  claims: [
    { key: "initial-jobless-claims", label: "初请失业金人数", patterns: [/\binitial\s+(?:jobless|unemployment)\s+claims\b/i] },
    { key: "continuing-jobless-claims", label: "续请失业金人数", patterns: [/\bcontinuing\s+(?:jobless|unemployment)\s+claims\b/i] },
  ],
  fomc: [
    { key: "fed-interest-rate", label: "联邦基金目标利率", patterns: [/\b(?:fed|federal\s+reserve|fomc)\b.*\b(?:interest|funds|target)\s+rate\b/i] },
  ],
};

function isUsCountry(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^(?:us|usa|united states|united states of america)$/i.test(value.trim());
}

function normalizeUnit(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const unit = value.trim();
  if (/^(?:percent|percentage)$/i.test(unit)) return "%";
  if (/^thousand$/i.test(unit)) return "K";
  if (/^million$/i.test(unit)) return "M";
  if (/^billion$/i.test(unit)) return "B";
  return unit;
}

function normalizeNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

function displayValue(value: unknown, unit?: string): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const raw = typeof value === "number" ? normalizeNumber(value) : typeof value === "string" ? value.trim() : "";
  if (!raw) return undefined;
  if (!unit || raw.toLowerCase().endsWith(unit.toLowerCase()) || (unit === "%" && raw.endsWith("%"))) return raw;
  return `${raw}${unit}`;
}

function parseProviderDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  const plainDate = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/)?.[1];
  if (plainDate) return plainDate;
  const iso = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed) ? trimmed : `${trimmed.replace(" ", "T")}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((item) => item.type === type)?.value ?? "";
  const year = part("year");
  const month = part("month");
  const day = part("day");
  return year && month && day ? `${year}-${month}-${day}` : undefined;
}

export function parseFmpCalendar(payload: unknown): NormalizedValueRecord[] {
  if (!Array.isArray(payload)) throw new Error("FMP response is not an array");
  const records: NormalizedValueRecord[] = [];
  for (const item of payload as FmpCalendarEvent[]) {
    if (!item || !isUsCountry(item.country) || typeof item.event !== "string") continue;
    const date = parseProviderDate(item.date);
    const event = item.event.trim();
    if (!date || !event) continue;
    const unit = normalizeUnit(item.unit);
    const previous = displayValue(item.previous, unit);
    const actual = displayValue(item.actual, unit);
    if (previous === undefined && actual === undefined) continue;
    records.push({ date, event, ...(previous !== undefined ? { previous } : {}), ...(actual !== undefined ? { actual } : {}), ...(unit ? { unit } : {}) });
  }
  return records;
}

function ruleFor(category: Category, eventName: string): MetricRule | undefined {
  return RULES[category].find((rule) =>
    rule.patterns.some((pattern) => pattern.test(eventName))
    && !(rule.excludes?.some((pattern) => pattern.test(eventName)) ?? false));
}

function dayNumber(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / 86_400_000;
}

export function enrichWithValueRecords(events: CalendarEvent[], records: NormalizedValueRecord[]): CalendarEvent[] {
  return events.map((event) => {
    const releaseDate = event.start.slice(0, 10);
    const maxDistance = event.category === "claims" ? 0 : 3;
    const byKey = new Map<string, EconomicMetric>();
    for (const rule of RULES[event.category]) {
      const candidates = records
        .filter((record) => ruleFor(event.category, record.event)?.key === rule.key)
        .map((record) => ({ record, distance: Math.abs(dayNumber(record.date) - dayNumber(releaseDate)) }))
        .filter((candidate) => candidate.distance <= maxDistance)
        .sort((a, b) => a.distance - b.distance);
      if (!candidates.length) continue;
      const closest = candidates.filter((candidate) => candidate.distance === candidates[0].distance);
      if (closest.length !== 1) continue;
      const match = closest[0].record;
      byKey.set(rule.key, {
        key: rule.key,
        label: rule.label,
        ...(match.previous !== undefined ? { previous: match.previous } : {}),
        ...(match.actual !== undefined ? { actual: match.actual } : {}),
        ...(match.unit ? { unit: match.unit } : {}),
      });
    }
    const metrics = RULES[event.category].flatMap((rule) => {
      const metric = byKey.get(rule.key);
      return metric ? [metric] : [];
    });
    return metrics.length ? { ...event, metrics } : event;
  });
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return isoDate(result);
}

function chunks(from: string, to: string): Array<{ from: string; to: string }> {
  const result: Array<{ from: string; to: string }> = [];
  for (let start = from; start <= to;) {
    const end = addDays(start, CHUNK_DAYS - 1);
    result.push({ from: start, to: end < to ? end : to });
    start = addDays(end, 1);
  }
  return result;
}

function defaultCache(): Cache | undefined {
  try {
    return typeof caches === "undefined" ? undefined : (caches as CacheStorage & { default?: Cache }).default;
  } catch {
    return undefined;
  }
}

async function fetchChunk(from: string, to: string, apiKey: string): Promise<NormalizedValueRecord[]> {
  const cache = defaultCache();
  const cacheKey = new Request(`https://fmp-values.us-economic-calendar.internal/${from}/${to}`);
  const cached = await cache?.match(cacheKey);
  if (cached) {
    try {
      return parseFmpCalendar(await cached.json());
    } catch {
      // Ignore an invalid edge-cache entry and refresh it from FMP.
    }
  }

  const url = new URL(FMP_URL);
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  const response = await fetch(url, {
    headers: {
      apikey: apiKey,
      "user-agent": "US-Economic-Calendar/1.0 (+calendar subscription)",
    },
  });
  if (!response.ok) throw new Error(`FMP HTTP ${response.status}`);
  const payload: unknown = await response.json();
  const records = parseFmpCalendar(payload);
  if (cache) {
    try {
      await cache.put(cacheKey, Response.json(payload, {
        headers: { "cache-control": `public, max-age=${CACHE_SECONDS}, stale-if-error=86400` },
      }));
    } catch {
      // Value enrichment should still succeed when an edge cache is unavailable.
    }
  }
  return records;
}

async function fetchValues(events: CalendarEvent[], apiKey: string): Promise<ProviderResult> {
  if (!events.length) return { records: [], state: "ok" };
  const dates = events.map((event) => event.start.slice(0, 10)).sort();
  const ranges = chunks(dates[0], dates[dates.length - 1]);
  const results = await Promise.allSettled(ranges.map((range) => fetchChunk(range.from, range.to, apiKey)));
  const records = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length === results.length) {
    const first = failed[0] as PromiseRejectedResult | undefined;
    return { records: [], state: "unavailable", detail: first?.reason instanceof Error ? first.reason.message : "FMP request failed" };
  }
  return {
    records,
    state: "ok",
    ...(failed.length ? { detail: `${failed.length} of ${results.length} date ranges unavailable` } : {}),
  };
}

export async function enrichEventsWithFmp(events: CalendarEvent[], apiKey?: string): Promise<EnrichmentResult> {
  if (!apiKey) {
    return {
      events,
      status: { provider: "fmp", state: "disabled", matchedEvents: 0, metrics: 0, detail: "FMP_API_KEY is not configured" },
    };
  }
  const provider = await fetchValues(events, apiKey);
  if (provider.state === "unavailable") {
    return {
      events,
      status: { provider: "fmp", state: "unavailable", matchedEvents: 0, metrics: 0, ...(provider.detail ? { detail: provider.detail } : {}) },
    };
  }
  const enriched = enrichWithValueRecords(events, provider.records);
  const matchedEvents = enriched.filter((event) => event.metrics?.length).length;
  const metrics = enriched.reduce((total, event) => total + (event.metrics?.length ?? 0), 0);
  return {
    events: enriched,
    status: { provider: "fmp", state: "ok", matchedEvents, metrics, ...(provider.detail ? { detail: provider.detail } : {}) },
  };
}
