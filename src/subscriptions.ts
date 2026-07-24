import {
  canonicalSymbol,
  type IndexDataset,
  type IndexId,
  type IndexMember,
} from "./constituents";
import type { CalendarEvent } from "./types";

export const STOCKS_QUERY_PARAM = "stocks";
export const NO_STOCKS_TOKEN = "NONE";
const MAX_SELECTED_STOCKS = 700;
const VALID_SYMBOL = /^[A-Z0-9][A-Z0-9-]{0,11}$/;

export interface StockCatalogItem {
  symbol: string;
  companyName: string;
  industry: string;
  indices: IndexId[];
}

interface MutableCatalogItem extends StockCatalogItem {
  member: IndexMember;
}

function isPlaceholderName(member: IndexMember): boolean {
  return !member.companyName.trim() || canonicalSymbol(member.companyName) === canonicalSymbol(member.symbol);
}

/** Merge overlapping index membership into one selectable stock row. */
export function buildStockCatalog(dataset: IndexDataset): StockCatalogItem[] {
  const stocks = new Map<string, MutableCatalogItem>();
  const add = (member: IndexMember, index: IndexId): void => {
    const symbol = canonicalSymbol(member.symbol);
    const current = stocks.get(symbol);
    if (!current) {
      stocks.set(symbol, {
        symbol,
        companyName: member.companyName || symbol,
        industry: member.industry,
        indices: [index],
        member,
      });
      return;
    }

    if (!current.indices.includes(index)) current.indices.push(index);
    if (isPlaceholderName(current.member) && !isPlaceholderName(member)) {
      current.member = member;
      current.companyName = member.companyName;
    }
    if (!current.industry && member.industry) current.industry = member.industry;
  };

  for (const member of dataset.sp500) add(member, "sp500");
  for (const member of dataset.nasdaq100) add(member, "nasdaq100");
  return [...stocks.values()]
    .map(({ member: _member, ...stock }) => stock)
    .sort((left, right) => left.symbol.localeCompare(right.symbol));
}

/**
 * A missing query parameter preserves the legacy all-stock feed. An explicitly
 * empty parameter means "economic releases only".
 */
export function requestedStocks(url: URL): Set<string> | null {
  if (!url.searchParams.has(STOCKS_QUERY_PARAM)) return null;
  const result = new Set<string>();
  for (const rawValue of url.searchParams.getAll(STOCKS_QUERY_PARAM)) {
    for (const value of rawValue.split(",")) {
      const symbol = canonicalSymbol(value);
      if (symbol === NO_STOCKS_TOKEN) continue;
      if (!VALID_SYMBOL.test(symbol)) continue;
      result.add(symbol);
      if (result.size >= MAX_SELECTED_STOCKS) return result;
    }
  }
  return result;
}

function eventMatchesSelection(event: CalendarEvent, selection: ReadonlySet<string>): boolean {
  if (event.category !== "earnings") return true;
  if (event.stockSymbol) return selection.has(canonicalSymbol(event.stockSymbol));
  return [...selection].some((symbol) => event.id.startsWith(`earnings-${symbol.toLowerCase()}-`));
}

/** Keep all economic releases while narrowing earnings events to the selection. */
export function filterEventsForStocks(
  events: readonly CalendarEvent[],
  selection: ReadonlySet<string> | null,
): CalendarEvent[] {
  return selection === null ? [...events] : events.filter((event) => eventMatchesSelection(event, selection));
}

function blockMatchesSelection(block: string, selection: ReadonlySet<string>): boolean {
  if (!/(?:^|\r?\n)CATEGORIES:EARNINGS\r?$/m.test(block)) return true;
  const marker = block.match(/(?:^|\r?\n)X-STOCK-SYMBOL:([^\r\n]+)/)?.[1]?.trim();
  if (marker) return selection.has(canonicalSymbol(marker));
  return [...selection].some((symbol) => block.includes(`UID:earnings-${symbol.toLowerCase()}-`));
}

/**
 * Migration fallback for snapshots created before structured calendar events
 * were stored in KV.
 */
export function filterIcsForStocks(ics: string, selection: ReadonlySet<string> | null): string {
  if (selection === null) return ics;
  return ics.replace(
    /BEGIN:VEVENT\r?\n[\s\S]*?END:VEVENT\r?\n/g,
    (block) => blockMatchesSelection(block, selection) ? block : "",
  );
}

export function icsEventCount(ics: string): number {
  return (ics.match(/BEGIN:VEVENT\r?$/gm) ?? []).length;
}
