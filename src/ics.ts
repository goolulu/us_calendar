import { addMinutes, formatIcsLocal } from "./date";
import type { CalendarEvent, EconomicMetric } from "./types";

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function foldLine(line: string): string[] {
  const encoder = new TextEncoder();
  const result: string[] = [];
  let current = "";
  let limit = 75;
  for (const char of line) {
    if (encoder.encode(current + char).length > limit) {
      result.push(current);
      current = ` ${char}`;
      limit = 75;
    } else {
      current += char;
    }
  }
  if (current) result.push(current);
  return result;
}

function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function metricLines(metrics: EconomicMetric[] | undefined): string {
  if (!metrics?.length) return "";
  const lines = metrics.map((metric) => {
    const values = [
      ...(metric.previous !== undefined ? [`前值 ${metric.previous}`] : []),
      ...(metric.actual !== undefined ? [`实际值 ${metric.actual}`] : []),
    ];
    return `• ${metric.label}：${values.join("；")}`;
  });
  return `\n\n关键数据：\n${lines.join("\n")}`;
}

export function createIcs(events: CalendarEvent[], now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//US Economic Calendar//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:美国重要经济数据",
    "X-WR-CALDESC:CPI、PPI、PCE、ADP、非农、初请失业金及 FOMC",
    "X-WR-TIMEZONE:America/New_York",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
    "BEGIN:VTIMEZONE",
    "TZID:America/New_York",
    "X-LIC-LOCATION:America/New_York",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0400",
    "TZNAME:EDT",
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0400",
    "TZOFFSETTO:-0500",
    "TZNAME:EST",
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
  const unique = [...new Map(events.map((event) => [event.id, event])).values()]
    .sort((a, b) => a.start.localeCompare(b.start));
  for (const event of unique) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@us-economic-calendar`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;TZID=America/New_York:${formatIcsLocal(event.start)}00`,
      `DTEND;TZID=America/New_York:${formatIcsLocal(addMinutes(event.start, event.durationMinutes))}00`,
      `SUMMARY:${escapeText(event.title)}`,
      `DESCRIPTION:${escapeText(`${event.description}${metricLines(event.metrics)}\n时间均为美国东部时间，iOS 会自动换算为本地时间。`)}`,
      `URL:${event.sourceUrl}`,
      `CATEGORIES:${event.category.toUpperCase()}`,
      "STATUS:CONFIRMED",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.flatMap(foldLine).join("\r\n") + "\r\n";
}
