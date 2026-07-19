import { afterEach, describe, expect, it, vi } from "vitest";
import { generateClaims } from "../src/generated";
import { createIcs } from "../src/ics";
import { buildEvents } from "../src/index";
import { parseBea, parseBls, parseFomc } from "../src/parsers";
import type { CalendarEvent } from "../src/types";
import { enrichWithValueRecords, parseFmpCalendar } from "../src/values";

afterEach(() => vi.restoreAllMocks());

describe("official schedule parsers", () => {
  it("parses only selected BLS releases", () => {
    const html = `<table><tr class="release-list"><td class="date-cell"><p>Tuesday, July 14, 2026</p></td><td class="time-cell"><p>08:30 AM</p></td><td class="desc-cell"><p><strong>Consumer Price Index</strong> for June 2026</p></td></tr><tr><td class="date-cell">Friday, August 7, 2026</td><td class="time-cell">08:30 AM</td><td class="desc-cell"><strong>Employment Situation</strong> for July 2026</td></tr><tr><td class="date-cell">Friday, August 7, 2026</td><td class="time-cell">10:00 AM</td><td class="desc-cell"><strong>Other Release</strong></td></tr></table>`;
    const events = parseBls(html);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ category: "cpi", start: "2026-07-14T08:30" });
    expect(events[1]).toMatchObject({ category: "nfp", start: "2026-08-07T08:30" });
  });

  it("parses BEA PCE and ignores GDP", () => {
    const html = `<table><thead><th>Year 2026</th></thead><tr><td><div class="release-date">July 30</div><small>8:30 AM</small></td><td class="release-title views-field">Personal Income and Outlays, June 2026</td></tr><tr><td><div class="release-date">July 30</div><small>8:30 AM</small></td><td class="release-title">GDP (Advance Estimate)</td></tr></table>`;
    expect(parseBea(html)).toMatchObject([{ category: "pce", start: "2026-07-30T08:30" }]);
  });

  it("uses the FOMC decision day at 2 PM", () => {
    const html = `<div class="panel panel-default"><div class="panel-heading"><h4><a>2026 FOMC Meetings</a></h4></div><div class="row fomc-meeting"><div class="fomc-meeting__month"><strong>September</strong></div><div class="fomc-meeting__date">15-16*</div></div></div><div class="panel panel-default"><h4>2025 FOMC Meetings</h4></div>`;
    expect(parseFomc(html, [2026])).toMatchObject([{ category: "fomc", start: "2026-09-16T14:00" }]);
    expect(parseFomc(html, [2026])[0].description).toContain("SEP");
  });

  it("lets live dates override fallbacks while other sources degrade independently", async () => {
    const bls = `<tr><td class="date-cell">Saturday, September 12, 2026</td><td class="time-cell">08:30 AM</td><td class="desc-cell"><strong>Consumer Price Index</strong> for August 2026</td></tr>`;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("bls.gov")) return new Response(bls);
      return new Response("unavailable", { status: 503 });
    });
    const result = await buildEvents(new Date("2026-07-14T00:00:00Z"));
    expect(result.events.find((event) => event.id === "cpi-2026-08")?.start).toBe("2026-09-12T08:30");
    expect(result.sources.find((source) => source.source === "bls")?.state).toBe("ok");
    expect(result.sources.find((source) => source.source === "bea")?.state).toBe("fallback");
    expect(result.sources.find((source) => source.source === "fomc")?.state).toBe("fallback");
  });
});

describe("calendar output", () => {
  it("generates weekly Thursday claims", () => {
    const events = generateClaims(new Date("2026-07-14T00:00:00Z"), 1, 0);
    expect(events[0].start).toBe("2026-07-16T08:30");
    expect(events[1].start).toBe("2026-07-23T08:30");
  });

  it("produces an iOS-compatible CRLF calendar with stable UIDs", () => {
    const event = generateClaims(new Date("2026-07-14T00:00:00Z"), 1, 0)[0];
    const ics = createIcs([event], new Date("2026-07-14T00:00:00Z"));
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("UID:claims-week-ending-2026-07-11@us-economic-calendar");
    expect(ics).toContain("DTSTART;TZID=America/New_York:20260716T083000");
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("moves a Thursday federal-holiday claims release to Wednesday", () => {
    const events = generateClaims(new Date("2026-11-20T00:00:00Z"), 1, 0);
    const thanksgiving = events.find((event) => event.id === "claims-week-ending-2026-11-21");
    expect(thanksgiving?.start).toBe("2026-11-25T08:30");
  });

  it("keeps a release UID when its date changes", () => {
    const event = generateClaims(new Date("2026-07-14T00:00:00Z"), 1, 0)[0];
    const moved = { ...event, start: "2026-07-15T08:30" };
    expect(createIcs([event])).toContain(`UID:${event.id}@us-economic-calendar`);
    expect(createIcs([moved])).toContain(`UID:${event.id}@us-economic-calendar`);
  });

  it("folds every content line to at most 75 UTF-8 octets", () => {
    const event = generateClaims(new Date("2026-07-14T00:00:00Z"), 1, 0)[0];
    const ics = createIcs([{ ...event, description: "中文说明".repeat(40) }]);
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

describe("FMP value enrichment", () => {
  const event = (category: CalendarEvent["category"], start: string): CalendarEvent => ({
    id: `${category}-test`,
    category,
    title: category.toUpperCase(),
    description: "测试事件",
    start,
    durationMinutes: 30,
    sourceUrl: "https://example.com",
  });

  it("normalizes U.S. values, units, UTC dates, and numeric zero", () => {
    const records = parseFmpCalendar([
      { date: "2026-07-14 12:30:00", country: "US", event: "CPI (YoY)", previous: 3, actual: 0, unit: "percent" },
      { date: "2026-07-14 12:30:00", country: "Canada", event: "CPI (YoY)", previous: 2, actual: 2.1, unit: "%" },
      { date: "2026-07-14 12:30:00", country: "United States", event: "No values", previous: null, actual: null },
    ]);
    expect(records).toEqual([{
      date: "2026-07-14",
      event: "CPI (YoY)",
      previous: "3%",
      actual: "0%",
      unit: "%",
    }]);
  });

  it("adds ordered key metrics without changing event identity or schedule", () => {
    const source = event("cpi", "2026-07-14T08:30");
    const [enriched] = enrichWithValueRecords([source], [
      { date: "2026-07-14", event: "United States Core CPI MoM", previous: "0.2%", actual: "0.3%", unit: "%" },
      { date: "2026-07-14", event: "United States CPI YoY", previous: "3.0%", actual: "2.9%", unit: "%" },
      { date: "2026-07-14", event: "United States CPI MoM", previous: "0.1%", actual: "0.2%", unit: "%" },
      { date: "2026-07-14", event: "United States Retail Sales MoM", previous: "0.1%", actual: "0.4%", unit: "%" },
    ]);
    expect(enriched).toMatchObject({ id: source.id, start: source.start, sourceUrl: source.sourceUrl });
    expect(enriched.metrics?.map((metric) => metric.key)).toEqual(["core-cpi-mom", "cpi-yoy", "cpi-mom"]);
  });

  it("allows small monthly-date differences but requires exact claim dates", () => {
    const enriched = enrichWithValueRecords([
      event("pce", "2026-07-30T08:30"),
      event("claims", "2026-07-30T08:30"),
    ], [
      { date: "2026-07-31", event: "PCE Price Index YoY", previous: "2.5%", actual: "2.6%" },
      { date: "2026-07-31", event: "Initial Jobless Claims", previous: "220K", actual: "218K" },
    ]);
    expect(enriched[0].metrics?.[0].key).toBe("pce-yoy");
    expect(enriched[1].metrics).toBeUndefined();
  });

  it("rejects ambiguous equally close value records", () => {
    const [enriched] = enrichWithValueRecords([event("cpi", "2026-07-14T08:30")], [
      { date: "2026-07-13", event: "CPI YoY", previous: "3.0%", actual: "2.9%" },
      { date: "2026-07-15", event: "Consumer Price Index YoY", previous: "3.1%", actual: "3.0%" },
    ]);
    expect(enriched.metrics).toBeUndefined();
  });

  it("renders previous and actual values in the ICS description", () => {
    const source = {
      ...event("nfp", "2026-08-07T08:30"),
      metrics: [{ key: "nonfarm-payrolls", label: "新增非农就业", previous: "147K", actual: "180K", unit: "K" }],
    };
    const ics = createIcs([source], new Date("2026-08-07T13:00:00Z"));
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("关键数据：\\n");
    expect(unfolded).toContain("前值 147K；实际值 180K");
  });

  it("keeps schedule events when the configured FMP provider fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("bls.gov")) {
        return new Response(`<tr><td class="date-cell">Tuesday, July 14, 2026</td><td class="time-cell">08:30 AM</td><td class="desc-cell"><strong>Consumer Price Index</strong> for June 2026</td></tr>`);
      }
      return new Response("unavailable", { status: 503 });
    });
    const result = await buildEvents(new Date("2026-07-14T00:00:00Z"), { fmpApiKey: "test-key" });
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.values).toMatchObject({ provider: "fmp", state: "unavailable", matchedEvents: 0, metrics: 0 });
  });
});
