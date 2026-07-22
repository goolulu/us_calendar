import { isoDate, localDateTime } from "./date";
import { adpEvent } from "./parsers";
import type { CalendarEvent, Category } from "./types";

type FallbackRelease = [category: Exclude<Category, "claims" | "fomc" | "adp" | "earnings">, period: string, start: string];

// Verified against the official schedules on 2026-07-14. Live agency data always
// wins; these records keep the feed useful during temporary upstream failures.
const RELEASES_2026: FallbackRelease[] = [
  ["cpi", "2026-06", "2026-07-14T08:30"], ["ppi", "2026-06", "2026-07-15T08:30"],
  ["nfp", "2026-07", "2026-08-07T08:30"], ["cpi", "2026-07", "2026-08-12T08:30"], ["ppi", "2026-07", "2026-08-13T08:30"],
  ["pce", "2026-06", "2026-07-30T08:30"], ["pce", "2026-07", "2026-08-26T08:30"],
  ["nfp", "2026-08", "2026-09-04T08:30"], ["ppi", "2026-08", "2026-09-10T08:30"], ["cpi", "2026-08", "2026-09-11T08:30"], ["pce", "2026-08", "2026-09-30T08:30"],
  ["nfp", "2026-09", "2026-10-02T08:30"], ["cpi", "2026-09", "2026-10-14T08:30"], ["ppi", "2026-09", "2026-10-15T08:30"], ["pce", "2026-09", "2026-10-29T08:30"],
  ["nfp", "2026-10", "2026-11-06T08:30"], ["cpi", "2026-10", "2026-11-10T08:30"], ["ppi", "2026-10", "2026-11-13T08:30"], ["pce", "2026-10", "2026-11-25T08:30"],
  ["nfp", "2026-11", "2026-12-04T08:30"], ["cpi", "2026-11", "2026-12-10T08:30"], ["ppi", "2026-11", "2026-12-15T08:30"], ["pce", "2026-11", "2026-12-23T08:30"],
];

const ADP_2026 = ["2026-08-05", "2026-09-02", "2026-09-30", "2026-11-04", "2026-12-02"];

const FOMC: Record<number, Array<[start: string, sep: boolean]>> = {
  2026: [["2026-01-28T14:00", false], ["2026-03-18T14:00", true], ["2026-04-29T14:00", false], ["2026-06-17T14:00", true], ["2026-07-29T14:00", false], ["2026-09-16T14:00", true], ["2026-10-28T14:00", false], ["2026-12-09T14:00", true]],
  2027: [["2027-01-27T14:00", false], ["2027-03-17T14:00", true], ["2027-04-28T14:00", false], ["2027-06-09T14:00", true], ["2027-07-28T14:00", false], ["2027-09-15T14:00", true], ["2027-10-27T14:00", false], ["2027-12-08T14:00", true]],
};

const META = {
  cpi: ["🇺🇸 美国 CPI", "美国消费者价格指数（CPI）公布", "https://www.bls.gov/schedule/"],
  ppi: ["🇺🇸 美国 PPI", "美国生产者价格指数（PPI）公布", "https://www.bls.gov/schedule/"],
  nfp: ["🇺🇸 美国非农就业 NFP（大非农）", "美国就业形势报告：非农就业人数、失业率等", "https://www.bls.gov/schedule/"],
  pce: ["🇺🇸 美国 PCE 物价指数", "美国个人收入与支出报告（含 PCE 及核心 PCE）", "https://www.bea.gov/news/schedule/"],
} as const;

export function fallbackReleases(): CalendarEvent[] {
  return RELEASES_2026.map(([category, period, start]) => ({
    id: `${category}-${period}`,
    category,
    title: META[category][0],
    description: `${META[category][1]}；数据期：${period}`,
    start,
    durationMinutes: 30,
    sourceUrl: META[category][2],
  }));
}

export function fallbackAdp(year: number): CalendarEvent[] {
  if (year === 2026) return ADP_2026.map((date) => adpEvent(`${date}T08:15`));
  return [];
}

export function fallbackFomc(years: number[]): CalendarEvent[] {
  return years.flatMap((year) => (FOMC[year] ?? []).map(([start, sep], index) => ({
    id: `fomc-${year}-${String(index + 1).padStart(2, "0")}`,
    category: "fomc" as const,
    title: "🇺🇸 美联储利率决议（FOMC）",
    description: `FOMC 议息会议决议公布${sep ? "；含经济预测（SEP）" : ""}`,
    start,
    durationMinutes: 60,
    sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
  })));
}

function isThursdayFederalHoliday(date: Date): boolean {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  // Fixed-date federal holidays which can collide with a Thursday release.
  if (["01-01", "06-19", "07-04", "11-11", "12-25"].includes(`${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`)) return true;
  // Thanksgiving: fourth Thursday in November.
  return month === 11 && day >= 22 && day <= 28;
}

export function generateClaims(from: Date, monthsAhead = 15, daysBack = 90): CalendarEvent[] {
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() - daysBack));
  const end = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + monthsAhead, from.getUTCDate()));
  while (start.getUTCDay() !== 4) start.setUTCDate(start.getUTCDate() + 1);
  const events: CalendarEvent[] = [];
  for (const scheduledThursday = new Date(start); scheduledThursday <= end; scheduledThursday.setUTCDate(scheduledThursday.getUTCDate() + 7)) {
    const releaseDay = new Date(scheduledThursday);
    if (isThursdayFederalHoliday(releaseDay)) releaseDay.setUTCDate(releaseDay.getUTCDate() - 1);
    const weekEnding = new Date(scheduledThursday);
    weekEnding.setUTCDate(weekEnding.getUTCDate() - 5);
    const releaseDate = isoDate(releaseDay);
    const [year, month, day] = releaseDate.split("-").map(Number);
    const startTime = localDateTime(year, month, day, "8:30 AM");
    if (!startTime) continue;
    events.push({
      id: `claims-week-ending-${isoDate(weekEnding)}`,
      category: "claims",
      title: "🇺🇸 美国初请/续请失业金人数",
      description: `美国劳工部每周失业保险报告（初请及续请）；统计周截至 ${isoDate(weekEnding)}`,
      start: startTime,
      durationMinutes: 30,
      sourceUrl: "https://www.dol.gov/newsroom/economicdata",
    });
  }
  return events;
}
