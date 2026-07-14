const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

export function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function monthNumber(value: string): number | undefined {
  return MONTHS[value.trim().toLowerCase()];
}

export function localDateTime(year: number, month: number, day: number, time: string): string | undefined {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return undefined;
  let hour = Number(match[1]);
  if (match[3].toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (match[3].toUpperCase() === "AM" && hour === 12) hour = 0;
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${match[2]}`;
}

export function addMinutes(local: string, minutes: number): string {
  const [date, time] = local.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day, hour, minute + minutes));
  return `${result.getUTCFullYear()}-${pad(result.getUTCMonth() + 1)}-${pad(result.getUTCDate())}T${pad(result.getUTCHours())}:${pad(result.getUTCMinutes())}`;
}

export function formatIcsLocal(local: string): string {
  return local.replace(/[-:]/g, "");
}

export function isoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function parseReportPeriod(value: string): string | undefined {
  const match = value.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  const month = match && monthNumber(match[1]);
  return match && month ? `${match[2]}-${pad(month)}` : undefined;
}
