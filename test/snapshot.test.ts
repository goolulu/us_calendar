import { afterEach, describe, expect, it, vi } from "vitest";
import type { IndexDataset } from "../src/constituents";
import { EARNINGS_KV_KEYS, type EarningsRangeDataset } from "../src/earnings";
import worker, { rebuildSnapshot, type Env } from "../src/index";

interface Entry {
  value: string;
  metadata?: unknown;
}

class FakeKv {
  entries = new Map<string, Entry>();

  async get<T = string>(key: string, type?: "text" | "json"): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    return (type === "json" ? JSON.parse(entry.value) : entry.value) as T;
  }

  async put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: KVNamespacePutOptions): Promise<void> {
    if (typeof value !== "string") throw new Error("FakeKv only accepts strings");
    this.entries.set(key, { value, metadata: options?.metadata });
  }

  async getWithMetadata<T = unknown, M = unknown>(
    key: string,
    type: "text" | "json",
  ): Promise<{ value: T | string | null; metadata: M | null; cacheStatus: string | null }> {
    const entry = this.entries.get(key);
    if (!entry) return { value: null, metadata: null, cacheStatus: null };
    const value = type === "json" ? JSON.parse(entry.value) as T : entry.value;
    return { value, metadata: (entry.metadata ?? null) as M | null, cacheStatus: null };
  }
}

afterEach(() => vi.restoreAllMocks());

describe("persisted calendar snapshots", () => {
  it("stores a combined economic and earnings ICS plus health metadata", async () => {
    const now = new Date("2026-07-22T12:00:00Z");
    const indices: IndexDataset = {
      version: 1,
      updatedAt: now.toISOString(),
      sp500: [{ symbol: "AAPL", companyName: "Apple Inc.", industry: "Technology Hardware" }],
      nasdaq100: [{ symbol: "AAPL", companyName: "Apple Inc.", industry: "Technology Hardware" }],
      sources: { sp500: "test", nasdaq100: "test" },
      states: { sp500: "wikipedia", nasdaq100: "wikipedia" },
    };
    const past: EarningsRangeDataset = {
      version: 1,
      range: "past",
      anchor: "2026-07-22",
      updatedAt: now.toISOString(),
      failedDates: [],
      days: {
        "2026-07-22": {
          fetchedAt: now.toISOString(),
          rows: [{
            symbol: "AAPL",
            name: "Apple",
            marketCap: "$3T",
            fiscalQuarterEnding: "Jun/2026",
            epsForecast: "$1.42",
            noOfEsts: "12",
            time: "time-after-hours",
          }],
        },
      },
    };
    const kv = new FakeKv();
    kv.entries.set(EARNINGS_KV_KEYS.indices, { value: JSON.stringify(indices) });
    kv.entries.set(EARNINGS_KV_KEYS.past, { value: JSON.stringify(past) });
    const env: Env = { EARNINGS_DATA: kv as unknown as KVNamespace };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("unavailable", { status: 503 }));

    const health = await rebuildSnapshot(env, now);

    const calendar = kv.entries.get(EARNINGS_KV_KEYS.calendar);
    const calendarEvents = kv.entries.get(EARNINGS_KV_KEYS.calendarEvents);
    expect(calendar?.value).toContain("UID:earnings-aapl-2026-06@us-economic-calendar");
    expect(JSON.parse(calendarEvents!.value)).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "earnings", stockSymbol: "AAPL" }),
    ]));
    expect(calendar?.value).toContain("CATEGORIES:EARNINGS");
    expect(calendar?.value).toContain("CATEGORIES:CLAIMS");
    expect(calendar?.value).not.toContain("VALARM");
    expect(calendar?.metadata).toMatchObject({ generatedAt: now.toISOString(), events: health.events });
    expect(JSON.parse(kv.entries.get(EARNINGS_KV_KEYS.health)!.value)).toMatchObject({
      ok: false,
      events: health.events,
      sources: expect.arrayContaining([expect.objectContaining({ source: "nasdaq-earnings", state: "fallback", events: 1 })]),
    });

    const economicOnly = await worker.fetch(
      new Request("https://calendar.example/calendar.ics?stocks="),
      env,
    );
    expect(economicOnly.status).toBe(200);
    expect(economicOnly.headers.get("x-calendar-selected-stocks")).toBe("0");
    const personalizedIcs = await economicOnly.text();
    expect(personalizedIcs).toContain("CATEGORIES:CLAIMS");
    expect(personalizedIcs).not.toContain("CATEGORIES:EARNINGS");
  });

  it("falls back instead of returning 500 when KV reads fail", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("unavailable", { status: 503 }));
    const brokenKv = {
      get: vi.fn().mockRejectedValue(new Error("KV unavailable")),
      getWithMetadata: vi.fn().mockRejectedValue(new Error("KV unavailable")),
    } as unknown as KVNamespace;
    const env: Env = { EARNINGS_DATA: brokenKv };

    const calendar = await worker.fetch(new Request("https://calendar.example/calendar.ics"), env);
    expect(calendar.status).toBe(200);
    expect(await calendar.text()).toContain("CATEGORIES:CLAIMS");

    const health = await worker.fetch(new Request("https://calendar.example/health"), env);
    expect(health.status).toBe(503);
    expect(await health.json()).toMatchObject({
      ok: false,
      sources: expect.arrayContaining([
        expect.objectContaining({ source: "nasdaq-earnings", state: "unavailable" }),
      ]),
    });
  });

  it("serves the management page and a deduplicated stock catalog", async () => {
    const kv = new FakeKv();
    kv.entries.set(EARNINGS_KV_KEYS.indices, {
      value: JSON.stringify({
        version: 1,
        updatedAt: "2026-07-22T12:00:00.000Z",
        sp500: [{ symbol: "AAPL", companyName: "Apple Inc.", industry: "Technology" }],
        nasdaq100: [
          { symbol: "AAPL", companyName: "Apple Inc.", industry: "Technology" },
          { symbol: "MSFT", companyName: "Microsoft", industry: "Software" },
        ],
        sources: { sp500: "test", nasdaq100: "test" },
        states: { sp500: "wikipedia", nasdaq100: "wikipedia" },
      } satisfies IndexDataset),
    });
    const env: Env = { EARNINGS_DATA: kv as unknown as KVNamespace };

    const page = await worker.fetch(new Request("https://calendar.example/"), env);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("选择关注的公司");

    const response = await worker.fetch(new Request("https://calendar.example/api/stocks"), env);
    const catalog = await response.json<{
      source: string;
      counts: { unique: number };
      stocks: Array<{ symbol: string; indices: string[] }>;
    }>();
    expect(catalog.source).toBe("kv");
    expect(catalog.counts.unique).toBe(2);
    expect(catalog.stocks.find((stock) => stock.symbol === "AAPL")?.indices).toEqual(["sp500", "nasdaq100"]);
  });
});
