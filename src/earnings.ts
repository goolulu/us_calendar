import { monthNumber, newYorkDate, pad, shiftIsoDate } from "./date";
import { canonicalSymbol, type IndexDataset, type IndexMember } from "./constituents";
import type { CalendarEvent, SourceStatus } from "./types";

export const EARNINGS_KV_KEYS = {
  indices: "indices:v1",
  past: "earnings:past:v1",
  future: "earnings:future:v1",
  calendar: "calendar:v2",
  health: "health:v2",
} as const;

export type EarningsRange = "past" | "future";

export interface NasdaqEarningsRow {
  symbol: string;
  name: string;
  marketCap: string;
  fiscalQuarterEnding: string;
  /** Nasdaq's prior-year report date, used as a stable period fallback when fiscalQuarterEnding is absent. */
  lastYearReportDate?: string;
  epsForecast: string;
  noOfEsts: string;
  time: string;
}

export interface StoredEarningsDay {
  fetchedAt: string;
  rows: NasdaqEarningsRow[];
}

export interface EarningsRangeDataset {
  version: 1;
  range: EarningsRange;
  anchor: string;
  updatedAt: string;
  days: Record<string, StoredEarningsDay>;
  failedDates: string[];
}

const NASDAQ_URL = "https://api.nasdaq.com/api/calendar/earnings";
const NASDAQ_HEADERS = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  origin: "https://www.nasdaq.com",
  referer: "https://www.nasdaq.com/",
  "user-agent": "US-Economic-Calendar/1.0 (+calendar subscription)",
};

class RetriableNasdaqError extends Error {}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRow(row: Record<string, unknown>): NasdaqEarningsRow {
  const symbol = text(row.symbol).toUpperCase();
  return {
    symbol,
    name: text(row.name) || symbol,
    marketCap: text(row.marketCap),
    fiscalQuarterEnding: text(row.fiscalQuarterEnding),
    lastYearReportDate: text(row.lastYearRptDt),
    epsForecast: text(row.epsForecast),
    noOfEsts: text(row.noOfEsts),
    time: text(row.time),
  };
}

export async function fetchEarningsDay(
  date: string,
  fetcher: typeof fetch = fetch,
): Promise<NasdaqEarningsRow[]> {
  const response = await fetcher(`${NASDAQ_URL}?date=${date}`, {
    headers: NASDAQ_HEADERS,
    cf: { cacheEverything: true, cacheTtl: 21_600 },
  });
  if (!response.ok) {
    const message = `Nasdaq ${date}: HTTP ${response.status}`;
    if ([408, 425, 429].includes(response.status) || response.status >= 500) throw new RetriableNasdaqError(message);
    throw new Error(message);
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.status) || payload.status.rCode !== 200) {
    const code = isRecord(payload) && isRecord(payload.status) ? payload.status.rCode : "missing";
    throw new Error(`Nasdaq ${date}: API status ${String(code)}`);
  }
  if (!isRecord(payload.data) || !Object.prototype.hasOwnProperty.call(payload.data, "rows")) {
    throw new Error(`Nasdaq ${date}: malformed data`);
  }
  const rows = payload.data.rows;
  if (rows === null) return [];
  if (!Array.isArray(rows) || !rows.every(isRecord)) {
    throw new Error(`Nasdaq ${date}: malformed rows`);
  }
  if (rows.some((row) => typeof row.symbol !== "string" || !row.symbol.trim())) {
    throw new Error(`Nasdaq ${date}: malformed row symbol`);
  }
  return rows.map(normalizeRow);
}

function datesForRange(anchor: string, range: EarningsRange): string[] {
  const [from, until] = range === "past" ? [-30, 0] : [1, 30];
  return Array.from({ length: until - from + 1 }, (_, index) => shiftIsoDate(anchor, from + index));
}

export function isCompleteEarningsRange(dataset: EarningsRangeDataset): boolean {
  return dataset.failedDates.length === 0
    && datesForRange(dataset.anchor, dataset.range).every((date) => Object.prototype.hasOwnProperty.call(dataset.days, date));
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchEarningsDayWithRetry(date: string, fetcher: typeof fetch): Promise<NasdaqEarningsRow[]> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetchEarningsDay(date, fetcher);
    } catch (error) {
      const retryable = error instanceof RetriableNasdaqError || error instanceof TypeError;
      if (!retryable || attempt >= 2) throw error;
      if (fetcher === fetch) await delay(250 * (2 ** attempt));
    }
  }
}

export async function fetchEarningsRange(
  range: EarningsRange,
  now: Date,
  previous?: EarningsRangeDataset | null,
  fetcher: typeof fetch = fetch,
): Promise<EarningsRangeDataset> {
  const anchor = newYorkDate(now);
  const dates = datesForRange(anchor, range);
  const days: Record<string, StoredEarningsDay> = {};
  const failedDates: string[] = [];
  const fetchedAt = now.toISOString();

  // Keep request concurrency modest so scheduled refreshes do not overload Nasdaq.
  for (let start = 0; start < dates.length; start += 5) {
    const batch = dates.slice(start, start + 5);
    const results = await Promise.allSettled(batch.map(async (date) => ({
      date,
      rows: await fetchEarningsDayWithRetry(date, fetcher),
    })));
    for (let index = 0; index < results.length; index++) {
      const date = batch[index];
      const result = results[index];
      if (result.status === "fulfilled") {
        days[date] = { fetchedAt, rows: result.value.rows };
      } else {
        failedDates.push(date);
        const cached = previous?.days[date];
        if (cached) days[date] = cached;
      }
    }
    if (fetcher === fetch && start + batch.length < dates.length) await delay(120);
  }

  return { version: 1, range, anchor, updatedAt: fetchedAt, days, failedDates };
}

export async function loadEarningsRanges(kv: KVNamespace): Promise<{
  past: EarningsRangeDataset | null;
  future: EarningsRangeDataset | null;
}> {
  const [past, future] = await Promise.all([
    kv.get<EarningsRangeDataset>(EARNINGS_KV_KEYS.past, "json"),
    kv.get<EarningsRangeDataset>(EARNINGS_KV_KEYS.future, "json"),
  ]);
  return { past, future };
}

function fiscalPeriod(value: string): string | undefined {
  const match = value.match(/^([A-Za-z]+)\/(\d{4})$/);
  const month = match && monthNumber(match[1]);
  return match && month ? `${match[2]}-${pad(month)}` : undefined;
}

function priorYearReportPeriod(value: string | undefined): string | undefined {
  const match = value?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return undefined;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `prior-${match[3]}-${pad(month)}-${pad(day)}`;
}

function releasePeriod(row: NasdaqEarningsRow, announcementDate: string): string {
  const fiscal = fiscalPeriod(row.fiscalQuarterEnding);
  if (fiscal) return fiscal;
  const priorYear = priorYearReportPeriod(row.lastYearReportDate);
  if (priorYear) return priorYear;
  const month = Number(announcementDate.slice(5, 7));
  return `window-${announcementDate.slice(0, 4)}-q${Math.ceil(month / 3)}`;
}

interface Membership {
  labels: string[];
  member: IndexMember;
}

function membershipMap(indices: IndexDataset): Map<string, Membership> {
  const result = new Map<string, Membership>();
  const add = (member: IndexMember, label: string) => {
    const symbol = canonicalSymbol(member.symbol);
    const current = result.get(symbol);
    if (current) {
      if (!current.labels.includes(label)) current.labels.push(label);
      const currentIsPlaceholder = canonicalSymbol(current.member.companyName) === symbol;
      const nextIsPlaceholder = canonicalSymbol(member.companyName) === symbol;
      if ((!current.member.companyName || currentIsPlaceholder) && member.companyName && !nextIsPlaceholder) current.member = member;
    } else {
      result.set(symbol, { labels: [label], member });
    }
  };
  for (const member of indices.sp500) add(member, "S&P 500");
  for (const member of indices.nasdaq100) add(member, "Nasdaq-100");
  return result;
}

interface Candidate {
  row: NasdaqEarningsRow;
  date: string;
  fetchedAt: string;
  membership: Membership;
}

function eventFromCandidate(candidate: Candidate): CalendarEvent {
  const { row, date, membership } = candidate;
  const symbol = canonicalSymbol(row.symbol);
  const period = releasePeriod(row, date);
  const timing = row.time === "time-pre-market"
    ? { suffix: "（预计盘前）", start: `${date}T08:00`, allDay: false }
    : ["time-after-hours", "time-after-market"].includes(row.time)
      ? { suffix: "（预计盘后）", start: `${date}T16:00`, allDay: false }
      : { suffix: "", start: date, allDay: true };
  const memberCompanyName = membership.member.companyName.trim();
  const companyName = !memberCompanyName || canonicalSymbol(memberCompanyName) === symbol
    ? row.name || row.symbol
    : memberCompanyName;
  const details = [
    `公司：${companyName}`,
    `股票代码：${row.symbol}`,
    `所属指数：${membership.labels.join("、")}`,
    membership.member.industry ? `行业：${membership.member.industry}` : "",
    row.fiscalQuarterEnding ? `财务季度：${row.fiscalQuarterEnding}` : "",
    row.epsForecast && row.epsForecast !== "N/A" ? `EPS 预期：${row.epsForecast}` : "",
    row.noOfEsts && row.noOfEsts !== "N/A" ? `分析师数量：${row.noOfEsts}` : "",
    row.marketCap && row.marketCap !== "N/A" ? `市值：${row.marketCap}` : "",
    `报告时段：${timing.allDay ? "未注明" : timing.suffix.includes("盘前") ? "预计盘前（约定为美东 08:00）" : "预计盘后（约定为美东 16:00）"}`,
    "财报日期和时段可能调整，请以公司最终公告为准。",
  ].filter(Boolean);
  return {
    id: `earnings-${symbol.toLowerCase()}-${period}`,
    category: "earnings",
    title: `📊 ${row.symbol} ${companyName} 财报${timing.suffix}`,
    description: details.join("\n"),
    start: timing.start,
    durationMinutes: timing.allDay ? 1_440 : 30,
    allDay: timing.allDay,
    sourceUrl: `https://www.nasdaq.com/market-activity/stocks/${encodeURIComponent(symbol.toLowerCase())}/earnings`,
  };
}

export function buildEarningsEvents(
  past: EarningsRangeDataset | null,
  future: EarningsRangeDataset | null,
  indices: IndexDataset,
  now: Date,
): CalendarEvent[] {
  const anchor = newYorkDate(now);
  const from = shiftIsoDate(anchor, -30);
  const until = shiftIsoDate(anchor, 30);
  const memberships = membershipMap(indices);
  const byRelease = new Map<string, Candidate>();

  for (const dataset of [past, future]) {
    if (!dataset) continue;
    for (const [date, day] of Object.entries(dataset.days)) {
      if (date < from || date > until) continue;
      for (const row of day.rows) {
        const membership = memberships.get(canonicalSymbol(row.symbol));
        if (!membership) continue;
        const key = `${canonicalSymbol(row.symbol)}:${releasePeriod(row, date)}`;
        const candidate = { row, date, fetchedAt: day.fetchedAt, membership };
        const current = byRelease.get(key);
        if (!current || candidate.fetchedAt > current.fetchedAt || (candidate.fetchedAt === current.fetchedAt && date > current.date)) {
          byRelease.set(key, candidate);
        }
      }
    }
  }
  return [...byRelease.values()].map(eventFromCandidate);
}

function ageHours(value: string | undefined, now: Date): number {
  if (!value) return Number.POSITIVE_INFINITY;
  return (now.getTime() - new Date(value).getTime()) / 3_600_000;
}

export function earningsSourceStatus(
  past: EarningsRangeDataset | null,
  future: EarningsRangeDataset | null,
  eventCount: number,
  now: Date,
): SourceStatus {
  const anchor = newYorkDate(now);
  const expected = datesForRange(anchor, "past").concat(datesForRange(anchor, "future"));
  const available = new Set([...Object.keys(past?.days ?? {}), ...Object.keys(future?.days ?? {})]);
  const missing = expected.filter((date) => !available.has(date));
  const failures = [...(past?.failedDates ?? []), ...(future?.failedDates ?? [])];
  const fresh = ageHours(past?.updatedAt, now) <= 18 && ageHours(future?.updatedAt, now) <= 18;
  const state = fresh && !missing.length && !failures.length ? "ok" : available.size ? "fallback" : "unavailable";
  const updatedAt = [past?.updatedAt, future?.updatedAt].filter((value): value is string => Boolean(value)).sort().at(-1);
  return {
    source: "nasdaq-earnings",
    state,
    events: eventCount,
    updatedAt,
    coverage: { from: shiftIsoDate(anchor, -30), to: shiftIsoDate(anchor, 30), missingDates: missing.length },
    ...(missing.length || failures.length ? { detail: `${missing.length} missing date(s); ${failures.length} latest fetch failure(s)` } : {}),
  };
}
