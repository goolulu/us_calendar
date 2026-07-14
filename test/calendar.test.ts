import { afterEach, describe, expect, it, vi } from "vitest";
import { generateClaims } from "../src/generated";
import { createIcs } from "../src/ics";
import { buildEvents } from "../src/index";
import { parseBea, parseBls, parseFomc } from "../src/parsers";

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
