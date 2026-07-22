import { describe, expect, it, vi } from "vitest";
import type { IndexDataset } from "../src/constituents";
import {
  buildEarningsEvents,
  earningsSourceStatus,
  fetchEarningsDay,
  fetchEarningsRange,
  isCompleteEarningsRange,
  type EarningsRangeDataset,
  type NasdaqEarningsRow,
} from "../src/earnings";

const NOW = new Date("2026-07-22T12:00:00Z");

function row(overrides: Partial<NasdaqEarningsRow> = {}): NasdaqEarningsRow {
  return {
    symbol: "AAPL",
    name: "Apple API Name",
    marketCap: "$3,000,000,000,000",
    fiscalQuarterEnding: "Jun/2026",
    epsForecast: "$1.42",
    noOfEsts: "12",
    time: "time-after-hours",
    ...overrides,
  };
}

function indices(): IndexDataset {
  return {
    version: 1,
    updatedAt: NOW.toISOString(),
    sp500: [
      { symbol: "AAPL", companyName: "Apple Inc.", industry: "Technology Hardware" },
      { symbol: "BRK-B", companyName: "Berkshire Hathaway", industry: "Financials" },
    ],
    nasdaq100: [
      { symbol: "AAPL", companyName: "Apple Inc.", industry: "Technology Hardware" },
      { symbol: "MSFT", companyName: "Microsoft", industry: "Software" },
    ],
    sources: { sp500: "test", nasdaq100: "test" },
    states: { sp500: "wikipedia", nasdaq100: "wikipedia" },
  };
}

function dataset(range: "past" | "future", days: EarningsRangeDataset["days"]): EarningsRangeDataset {
  return { version: 1, range, anchor: "2026-07-22", updatedAt: NOW.toISOString(), days, failedDates: [] };
}

describe("Nasdaq earnings refresh", () => {
  it.each([
    ["empty payload", {}],
    ["missing status", { data: { rows: null } }],
    ["non-success API status", { status: { rCode: 500 }, data: { rows: null } }],
    ["null data", { status: { rCode: 200 }, data: null }],
    ["missing rows", { status: { rCode: 200 }, data: {} }],
    ["non-array rows", { status: { rCode: 200 }, data: { rows: {} } }],
    ["malformed row entry", { status: { rCode: 200 }, data: { rows: [null] } }],
    ["row without a symbol", { status: { rCode: 200 }, data: { rows: [{ name: "Missing symbol" }] } }],
  ])("rejects a 200 HTTP response with %s", async (_label, payload) => {
    const fetcher = vi.fn(async () => Response.json(payload)) as unknown as typeof fetch;
    await expect(fetchEarningsDay("2026-07-23", fetcher)).rejects.toThrow("Nasdaq 2026-07-23");
  });

  it("treats an explicitly null rows value as a valid empty day", async () => {
    const fetcher = vi.fn(async () => Response.json({ status: { rCode: 200 }, data: { rows: null } })) as unknown as typeof fetch;
    await expect(fetchEarningsDay("2026-07-23", fetcher)).resolves.toEqual([]);
  });

  it("fetches the complete future half and keeps cached data for a failed date", async () => {
    const failedDate = "2026-07-25";
    const previous = dataset("future", {
      [failedDate]: { fetchedAt: "2026-07-21T00:00:00.000Z", rows: [row()] },
    });
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const date = new URL(String(input)).searchParams.get("date");
      if (date === failedDate) return new Response("unavailable", { status: 503 });
      return Response.json({ data: { rows: null }, status: { rCode: 200 } });
    }) as unknown as typeof fetch;

    const result = await fetchEarningsRange("future", NOW, previous, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(32);
    expect(Object.keys(result.days)).toHaveLength(30);
    expect(result.failedDates).toEqual([failedDate]);
    expect(isCompleteEarningsRange(result)).toBe(false);
    expect(result.days[failedDate]).toEqual(previous.days[failedDate]);
    expect(result.days["2026-07-23"].rows).toEqual([]);
  });

  it("retries a transient Nasdaq failure before marking a date failed", async () => {
    const transientDate = "2026-07-25";
    let transientAttempts = 0;
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const date = new URL(String(input)).searchParams.get("date");
      if (date === transientDate && transientAttempts++ === 0) return new Response("busy", { status: 503 });
      return Response.json({ data: { rows: null }, status: { rCode: 200 } });
    }) as unknown as typeof fetch;

    const result = await fetchEarningsRange("future", NOW, null, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(31);
    expect(result.failedDates).toEqual([]);
    expect(isCompleteEarningsRange(result)).toBe(true);
  });

  it("normalizes Nasdaq rows", async () => {
    const fetcher = vi.fn(async () => Response.json({
      data: { rows: [{ symbol: " aapl ", name: " Apple ", time: "time-pre-market" }] },
      status: { rCode: 200 },
    })) as unknown as typeof fetch;

    const result = await fetchEarningsRange("future", NOW, null, fetcher);
    expect(isCompleteEarningsRange(result)).toBe(true);
    expect(result.days["2026-07-23"].rows).toEqual([
      expect.objectContaining({ symbol: "AAPL", name: "Apple", time: "time-pre-market" }),
    ]);
  });
});

describe("earnings event generation", () => {
  it("uses the Nasdaq company name when bundled membership only contains the symbol", () => {
    const bundledIndices = indices();
    bundledIndices.sp500[0] = { symbol: "AAPL", companyName: "AAPL", industry: "" };
    bundledIndices.nasdaq100[0] = { symbol: "AAPL", companyName: "AAPL", industry: "" };
    const future = dataset("future", {
      "2026-07-23": { fetchedAt: NOW.toISOString(), rows: [row({ name: "Apple Inc." })] },
    });

    const events = buildEarningsEvents(null, future, bundledIndices, NOW);

    expect(events[0].title).toContain("AAPL Apple Inc. 财报");
    expect(events[0].title).not.toContain("AAPL AAPL");
    expect(events[0].description).toContain("公司：Apple Inc.");
  });

  it("deduplicates rescheduled releases by symbol and fiscal period and annotates both indices", () => {
    const past = dataset("past", {
      "2026-07-21": { fetchedAt: "2026-07-21T10:00:00.000Z", rows: [row()] },
    });
    const future = dataset("future", {
      "2026-07-24": { fetchedAt: "2026-07-22T10:00:00.000Z", rows: [row()] },
    });

    const events = buildEarningsEvents(past, future, indices(), NOW);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "earnings-aapl-2026-06",
      start: "2026-07-24T16:00",
      durationMinutes: 30,
      allDay: false,
    });
    expect(events[0].description).toContain("所属指数：S&P 500、Nasdaq-100");
    expect(events[0].title).toContain("预计盘后");
  });

  it("keeps a stable release identity when the fiscal period is missing", () => {
    const future = dataset("future", {
      "2026-07-23": {
        fetchedAt: "2026-07-21T10:00:00.000Z",
        rows: [row({ symbol: "MSFT", fiscalQuarterEnding: "", lastYearReportDate: "7/24/2025" })],
      },
      "2026-07-24": {
        fetchedAt: "2026-07-22T10:00:00.000Z",
        rows: [row({ symbol: "MSFT", fiscalQuarterEnding: "", lastYearReportDate: "7/24/2025" })],
      },
    });

    const events = buildEarningsEvents(null, future, indices(), NOW);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "earnings-msft-prior-2025-07-24",
      start: "2026-07-24T16:00",
    });
  });

  it("uses 08:00 for pre-market, all-day for unknown sessions, and canonical ticker matching", () => {
    const future = dataset("future", {
      "2026-07-23": {
        fetchedAt: NOW.toISOString(),
        rows: [
          row({ symbol: "BRK.B", name: "Berkshire", time: "time-pre-market" }),
          row({ symbol: "MSFT", name: "Microsoft", fiscalQuarterEnding: "", time: "time-not-supplied" }),
          row({ symbol: "OTHER", name: "Not in either index" }),
        ],
      },
    });

    const events = buildEarningsEvents(null, future, indices(), NOW);
    expect(events).toHaveLength(2);
    expect(events.find((event) => event.id.startsWith("earnings-brk-b"))).toMatchObject({ start: "2026-07-23T08:00", allDay: false });
    expect(events.find((event) => event.id.startsWith("earnings-msft"))).toMatchObject({ start: "2026-07-23", allDay: true, durationMinutes: 1_440 });
  });

  it("reports incomplete persisted coverage as fallback", () => {
    const future = dataset("future", {
      "2026-07-23": { fetchedAt: NOW.toISOString(), rows: [row()] },
    });
    const status = earningsSourceStatus(null, future, 1, NOW);
    expect(status).toMatchObject({ source: "nasdaq-earnings", state: "fallback", events: 1 });
    expect(status.coverage?.missingDates).toBe(60);
  });
});
