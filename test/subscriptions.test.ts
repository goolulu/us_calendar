import { describe, expect, it } from "vitest";
import type { IndexDataset } from "../src/constituents";
import { createIcs } from "../src/ics";
import {
  buildStockCatalog,
  filterEventsForStocks,
  filterIcsForStocks,
  requestedStocks,
} from "../src/subscriptions";
import type { CalendarEvent } from "../src/types";

const economicEvent: CalendarEvent = {
  id: "claims-week-ending-2026-07-18",
  category: "claims",
  title: "初请失业金人数",
  description: "经济数据",
  start: "2026-07-23T08:30",
  durationMinutes: 30,
  sourceUrl: "https://example.com/claims",
};

function earnings(symbol: string): CalendarEvent {
  return {
    id: `earnings-${symbol.toLowerCase()}-2026-06`,
    category: "earnings",
    stockSymbol: symbol,
    title: `${symbol} 财报`,
    description: "财报",
    start: "2026-07-23",
    durationMinutes: 1_440,
    allDay: true,
    sourceUrl: "https://example.com/earnings",
  };
}

describe("personalized stock subscriptions", () => {
  it("merges companies that belong to both indices and keeps the richer member data", () => {
    const dataset: IndexDataset = {
      version: 1,
      updatedAt: "2026-07-24T00:00:00.000Z",
      sp500: [
        { symbol: "AAPL", companyName: "AAPL", industry: "" },
        { symbol: "BRK-B", companyName: "Berkshire Hathaway", industry: "Financials" },
      ],
      nasdaq100: [
        { symbol: "AAPL", companyName: "Apple Inc.", industry: "Technology" },
      ],
      sources: { sp500: "test", nasdaq100: "test" },
      states: { sp500: "snapshot", nasdaq100: "wikipedia" },
    };

    expect(buildStockCatalog(dataset)).toEqual([
      {
        symbol: "AAPL",
        companyName: "Apple Inc.",
        industry: "Technology",
        indices: ["sp500", "nasdaq100"],
      },
      {
        symbol: "BRK-B",
        companyName: "Berkshire Hathaway",
        industry: "Financials",
        indices: ["sp500"],
      },
    ]);
  });

  it("distinguishes the legacy all-stock feed from an explicit empty selection", () => {
    expect(requestedStocks(new URL("https://calendar.example/calendar.ics"))).toBeNull();
    expect(requestedStocks(new URL("https://calendar.example/calendar.ics?stocks="))).toEqual(new Set());
    expect(requestedStocks(new URL("https://calendar.example/calendar.ics?stocks=NONE"))).toEqual(new Set());
    expect(requestedStocks(new URL("https://calendar.example/calendar.ics?stocks=aapl,brk.b,not%20valid")))
      .toEqual(new Set(["AAPL", "BRK-B"]));
  });

  it("always keeps economic releases and includes only selected earnings", () => {
    const events = [economicEvent, earnings("AAPL"), earnings("MSFT")];
    expect(filterEventsForStocks(events, null)).toEqual(events);
    expect(filterEventsForStocks(events, new Set(["MSFT"]))).toEqual([
      economicEvent,
      earnings("MSFT"),
    ]);
    expect(filterEventsForStocks(events, new Set())).toEqual([economicEvent]);
  });

  it("filters legacy ICS snapshots, including hyphenated tickers", () => {
    const source = createIcs([economicEvent, earnings("BRK-B"), earnings("BRK")]);
    const filtered = filterIcsForStocks(source, new Set(["BRK-B"]));
    expect(filtered).toContain("UID:earnings-brk-b-2026-06@us-economic-calendar");
    expect(filtered).not.toContain("UID:earnings-brk-2026-06@us-economic-calendar");
    expect(filtered).toContain("CATEGORIES:CLAIMS");
  });
});
