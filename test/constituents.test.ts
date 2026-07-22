import { describe, expect, it, vi } from "vitest";
import {
  BUNDLED_SNAPSHOT_SOURCE,
  NASDAQ100_FALLBACK_SYMBOLS,
  NASDAQ100_WIKIPEDIA_URL,
  SP500_CSV_URL,
  SP500_FALLBACK_SYMBOLS,
  SP500_WIKIPEDIA_URL,
  bundledIndexDataset,
  canonicalSymbol,
  fetchIndexDataset,
  indexSourceStatuses,
  parseSp500Csv,
  parseWikipediaConstituents,
} from "../src/constituents";

function ticker(index: number): string {
  return `T${index.toString().padStart(4, "0")}`;
}

function wikipediaTable(kind: "sp500" | "nasdaq100", count: number): string {
  const isSp500 = kind === "sp500";
  const headers = isSp500
    ? "<th>Symbol</th><th>Security</th><th>GICS Sector</th>"
    : "<th>Ticker</th><th>Company</th><th>ICB Industry<sup>[1]</sup></th>";
  const rows = Array.from({ length: count }, (_, index) => {
    const symbol = index === 0 ? "brk.b" : ticker(index);
    const name = index === 0 ? "Berkshire &amp; Hathaway" : `Company ${index}`;
    return `<tr><td>${symbol}</td><td><a href="/company">${name}</a></td><td>${isSp500 ? "Financials" : "Technology"}</td></tr>`;
  }).join("");
  return `<html><table class="wikitable"><tr><th>Year</th><th>Return</th></tr><tr><td>2025</td><td>10%</td></tr></table><table id="constituents" class="sortable wikitable"><tr>${headers}</tr>${rows}</table></html>`;
}

function sp500Csv(count = 490): string {
  const rows = Array.from({ length: count }, (_, index) =>
    index === 0
      ? 'BRK.B,"Berkshire Hathaway, Inc.",Financials'
      : `${ticker(index)},Company ${index},Industrials`,
  );
  return `Symbol,Security,GICS Sector\r\n${rows.join("\r\n")}\r\n`;
}

describe("index constituent parsing", () => {
  it("canonicalizes class-share dots without changing hyphenated tickers", () => {
    expect(canonicalSymbol(" brk.b ")).toBe("BRK-B");
    expect(canonicalSymbol("bf-b")).toBe("BF-B");
  });

  it("selects the S&P constituent wikitable by its headers", () => {
    const members = parseWikipediaConstituents(wikipediaTable("sp500", 490), "sp500");
    expect(members).toHaveLength(490);
    expect(members[0]).toEqual({ symbol: "BRK-B", companyName: "Berkshire & Hathaway", industry: "Financials" });
  });

  it("accepts Nasdaq Ticker/Company and optional industry headers", () => {
    const members = parseWikipediaConstituents(wikipediaTable("nasdaq100", 95), "nasdaq100");
    expect(members).toHaveLength(95);
    expect(members[1]).toEqual({ symbol: "T0001", companyName: "Company 1", industry: "Technology" });
  });

  it("rejects a matching table whose constituent count is implausible", () => {
    expect(() => parseWikipediaConstituents(wikipediaTable("nasdaq100", 2), "nasdaq100")).toThrow(
      "Invalid nasdaq100 constituent count: 2",
    );
  });

  it("parses the quoted public S&P CSV fallback", () => {
    const members = parseSp500Csv(sp500Csv());
    expect(members).toHaveLength(490);
    expect(members[0]).toEqual({ symbol: "BRK-B", companyName: "Berkshire Hathaway, Inc.", industry: "Financials" });
  });
});

describe("index constituent fetching", () => {
  it("fetches both Wikipedia lists independently", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === SP500_WIKIPEDIA_URL) return new Response(wikipediaTable("sp500", 490));
      if (url === NASDAQ100_WIKIPEDIA_URL) return new Response(wikipediaTable("nasdaq100", 95));
      return new Response("unexpected", { status: 404 });
    }) as unknown as typeof fetch;

    const dataset = await fetchIndexDataset(new Date("2026-07-22T01:02:03Z"), fetcher);
    expect(dataset.updatedAt).toBe("2026-07-22T01:02:03.000Z");
    expect(dataset.states).toEqual({ sp500: "wikipedia", nasdaq100: "wikipedia" });
    expect(dataset.sources).toEqual({ sp500: SP500_WIKIPEDIA_URL, nasdaq100: NASDAQ100_WIKIPEDIA_URL });
    expect(dataset.sp500).toHaveLength(490);
    expect(dataset.nasdaq100).toHaveLength(95);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("uses the public CSV for S&P and the bundled snapshot for Nasdaq", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === SP500_CSV_URL) return new Response(sp500Csv());
      return new Response("unavailable", { status: 503 });
    }) as unknown as typeof fetch;

    const dataset = await fetchIndexDataset(new Date("2026-07-22T00:00:00Z"), fetcher);
    expect(dataset.states).toEqual({ sp500: "csv", nasdaq100: "snapshot" });
    expect(dataset.sources).toEqual({ sp500: SP500_CSV_URL, nasdaq100: BUNDLED_SNAPSHOT_SOURCE });
    expect(dataset.sp500[0].companyName).toBe("Berkshire Hathaway, Inc.");
    expect(dataset.nasdaq100).toHaveLength(NASDAQ100_FALLBACK_SYMBOLS.length);
  });

  it("falls back completely and reports health-compatible source statuses", async () => {
    const fetcher = vi.fn(async () => new Response("unavailable", { status: 503 })) as unknown as typeof fetch;
    const dataset = await fetchIndexDataset(new Date("2026-07-22T00:00:00Z"), fetcher);
    expect(dataset.sp500).toHaveLength(SP500_FALLBACK_SYMBOLS.length);
    expect(dataset.sp500.some((member) => member.symbol === "BRK-B")).toBe(true);
    expect(dataset.nasdaq100).toHaveLength(NASDAQ100_FALLBACK_SYMBOLS.length);
    expect(indexSourceStatuses(dataset)).toEqual([
      { source: "sp500-members", state: "fallback", events: SP500_FALLBACK_SYMBOLS.length, detail: BUNDLED_SNAPSHOT_SOURCE },
      { source: "nasdaq100-members", state: "fallback", events: NASDAQ100_FALLBACK_SYMBOLS.length, detail: BUNDLED_SNAPSHOT_SOURCE },
    ]);
  });

  it("constructs fresh bundled datasets", () => {
    const first = bundledIndexDataset(new Date("2026-07-22T00:00:00Z"));
    const second = bundledIndexDataset(new Date("2026-07-23T00:00:00Z"));
    first.sp500[0].companyName = "changed";
    expect(second.sp500[0].companyName).toBe(second.sp500[0].symbol);
    expect(second.updatedAt).toBe("2026-07-23T00:00:00.000Z");
  });
});
