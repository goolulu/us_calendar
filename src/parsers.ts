import { localDateTime, monthNumber, pad, parseReportPeriod, previousMonth } from "./date";
import type { CalendarEvent, Category } from "./types";

const SOURCE = {
  bls: "https://www.bls.gov/schedule/",
  bea: "https://www.bea.gov/news/schedule/",
  adp: "https://adpemploymentreport.com/",
  fomc: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
};

function stripHtml(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function blsInfo(name: string): { category: Category; title: string; description: string } | undefined {
  if (name === "Consumer Price Index") return { category: "cpi", title: "🇺🇸 美国 CPI", description: "美国消费者价格指数（CPI）公布" };
  if (name === "Producer Price Index") return { category: "ppi", title: "🇺🇸 美国 PPI", description: "美国生产者价格指数（PPI）公布" };
  if (name === "Employment Situation") return { category: "nfp", title: "🇺🇸 美国非农就业 NFP（大非农）", description: "美国就业形势报告：非农就业人数、失业率等" };
  return undefined;
}

export function parseBls(html: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = match[1];
    const dateText = stripHtml(row.match(/class=["'][^"']*date-cell[^"']*["'][^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? "");
    const time = stripHtml(row.match(/class=["'][^"']*time-cell[^"']*["'][^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? "");
    const descHtml = row.match(/class=["'][^"']*desc-cell[^"']*["'][^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? "";
    const name = stripHtml(descHtml.match(/<strong>([\s\S]*?)<\/strong>/i)?.[1] ?? "");
    const info = blsInfo(name);
    const date = dateText.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\w+)\s+(\d{1,2}),\s+(\d{4})/i);
    if (!info || !date) continue;
    const month = monthNumber(date[1]);
    const start = month && localDateTime(Number(date[3]), month, Number(date[2]), time);
    if (!start) continue;
    const period = stripHtml(descHtml).replace(name, "").trim();
    const reportPeriod = parseReportPeriod(period) ?? start.slice(0, 7);
    events.push({ id: `${info.category}-${reportPeriod}`, ...info, description: `${info.description}${period ? `（${period}）` : ""}`, start, durationMinutes: 30, sourceUrl: SOURCE.bls });
  }
  return events;
}

export function parseBea(html: string): CalendarEvent[] {
  const year = Number(stripHtml(html.match(/<th\b[^>]*>\s*Year\s+(\d{4})[\s\S]*?<\/th>/i)?.[1] ?? ""));
  if (!year) return [];
  const events: CalendarEvent[] = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = match[1];
    const title = stripHtml(row.match(/class=["'][^"']*release-title[^"']*["'][^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? "");
    if (!/^Personal Income and Outlays\b/i.test(title)) continue;
    const date = stripHtml(row.match(/class=["'][^"']*release-date[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "").match(/(\w+)\s+(\d{1,2})/);
    const time = stripHtml(row.match(/<small\b[^>]*>([\s\S]*?)<\/small>/i)?.[1] ?? "");
    if (!date) continue;
    const month = monthNumber(date[1]);
    const start = month && localDateTime(year, month, Number(date[2]), time);
    if (!start) continue;
    const period = title.replace(/^Personal Income and Outlays,?\s*/i, "");
    const reportPeriod = parseReportPeriod(period) ?? start.slice(0, 7);
    events.push({ id: `pce-${reportPeriod}`, category: "pce", title: "🇺🇸 美国 PCE 物价指数", description: `美国个人收入与支出报告（含 PCE 及核心 PCE）${period ? `；数据期：${period}` : ""}`, start, durationMinutes: 30, sourceUrl: SOURCE.bea });
  }
  return events;
}

export function parseAdp(html: string, defaultYear: number): CalendarEvent[] {
  const text = stripHtml(html);
  const block = text.match(/Upcoming Reports:\s*([\s\S]*?)(?:Upcoming reports \(weekly|Technical Notes|How are prior)/i)?.[1] ?? "";
  const events: CalendarEvent[] = [];
  for (const match of block.matchAll(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})/gi)) {
    const month = monthNumber(match[1]);
    const year = Number(match[3] || defaultYear);
    const start = month && localDateTime(year, month, Number(match[2]), "8:15 AM");
    if (start) events.push(adpEvent(start));
  }
  return events;
}

export function adpEvent(start: string): CalendarEvent {
  const [year, month, day] = start.slice(0, 10).split("-").map(Number);
  const period = day >= 20 ? { year, month } : previousMonth(year, month);
  const reportPeriod = `${period.year}-${pad(period.month)}`;
  return { id: `adp-${reportPeriod}`, category: "adp", title: "🇺🇸 ADP 就业（小非农）", description: `ADP 美国私营部门就业报告（小非农）；数据期：${reportPeriod}`, start, durationMinutes: 30, sourceUrl: SOURCE.adp };
}

export function parseFomc(html: string, years: number[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const year of years) {
    const startAt = html.search(new RegExp(`>${year} FOMC Meetings<`, "i"));
    if (startAt < 0) continue;
    const next = html.slice(startAt + 1).search(/<div class=["']panel panel-default["']/i);
    const section = html.slice(startAt, next < 0 ? undefined : startAt + 1 + next);
    const meetingPattern = /fomc-meeting__month[^>]*>([\s\S]*?)<\/div>[\s\S]{0,500}?fomc-meeting__date[^>]*>([\s\S]*?)<\/div>/gi;
    let sequence = 0;
    for (const rowMatch of section.matchAll(meetingPattern)) {
      sequence += 1;
      const monthText = stripHtml(rowMatch[1]);
      const dateText = stripHtml(rowMatch[2]);
      const days = dateText.match(/(\d{1,2})(?:\s*-\s*(\d{1,2}))?/);
      const month = monthNumber(monthText);
      if (!month || !days) continue;
      const decisionDay = Number(days[2] ?? days[1]);
      const start = `${year}-${pad(month)}-${pad(decisionDay)}T14:00`;
      events.push({ id: `fomc-${year}-${pad(sequence)}`, category: "fomc", title: "🇺🇸 美联储利率决议（FOMC）", description: `FOMC 议息会议决议公布${dateText.includes("*") ? "；含经济预测（SEP）" : ""}`, start, durationMinutes: 60, sourceUrl: SOURCE.fomc });
    }
  }
  return events;
}
