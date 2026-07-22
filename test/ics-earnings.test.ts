import { describe, expect, it } from "vitest";
import { createIcs } from "../src/ics";
import type { CalendarEvent } from "../src/types";

describe("mixed earnings calendar output", () => {
  it("writes all-day earnings with an exclusive next-day end", () => {
    const event: CalendarEvent = {
      id: "earnings-aapl-2026-q3",
      category: "earnings",
      title: "📊 AAPL Apple 财报",
      description: "预计财报公布日",
      start: "2026-07-31",
      durationMinutes: 1_440,
      allDay: true,
      sourceUrl: "https://www.nasdaq.com/market-activity/earnings",
    };

    const ics = createIcs([event], new Date("2026-07-22T00:00:00Z"));

    expect(ics).toContain("DTSTART;VALUE=DATE:20260731\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20260801\r\n");
    expect(ics).not.toContain("DTSTART;TZID=America/New_York:20260731");
    expect(ics).not.toContain("VALARM");
    expect(ics.replace(/\r\n[ \t]/g, "")).toContain("X-WR-CALNAME:美国经济数据与重点公司财报");
  });

  it("keeps timed event timezone and duration behavior unchanged", () => {
    const event: CalendarEvent = {
      id: "earnings-msft-2026-q4",
      category: "earnings",
      title: "📊 MSFT Microsoft 财报（预计盘后）",
      description: "预计盘后公布",
      start: "2026-07-28T16:00",
      durationMinutes: 30,
      sourceUrl: "https://www.nasdaq.com/market-activity/earnings",
    };

    const ics = createIcs([event], new Date("2026-07-22T00:00:00Z"));

    expect(ics).toContain("DTSTART;TZID=America/New_York:20260728T160000\r\n");
    expect(ics).toContain("DTEND;TZID=America/New_York:20260728T163000\r\n");
    expect(ics).not.toContain("DTSTART;VALUE=DATE");
  });

  it("folds mixed UTF-8 content without splitting code points or exceeding 75 octets", () => {
    const title = `📊 ${"财报".repeat(30)} ${"A".repeat(80)}`;
    const event: CalendarEvent = {
      id: "earnings-folding",
      category: "earnings",
      title,
      description: `中文🚀${"说明".repeat(40)}`,
      start: "2026-07-31",
      durationMinutes: 1_440,
      allDay: true,
      sourceUrl: "https://example.com/earnings",
    };

    const ics = createIcs([event]);
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    const unfolded = ics.replace(/\r\n[ \t]/g, "");
    expect(unfolded).toContain(`SUMMARY:${title}\r\n`);
    expect(unfolded).not.toContain("\ufffd");
  });
});
