export type Category = "cpi" | "ppi" | "pce" | "nfp" | "adp" | "claims" | "fomc" | "earnings";

export interface EconomicMetric {
  /** Stable identifier within a release category, for example cpi-yoy. */
  key: string;
  label: string;
  previous?: string;
  actual?: string;
  unit?: string;
}

export interface CalendarEvent {
  /** Stable identity. It must not change when an agency reschedules a release. */
  id: string;
  category: Category;
  /** Canonical ticker for earnings events, used to build personalized feeds. */
  stockSymbol?: string;
  title: string;
  description: string;
  /** America/New_York local time (YYYY-MM-DDTHH:mm), or YYYY-MM-DD when allDay is true. */
  start: string;
  durationMinutes: number;
  /** Emit a DATE-valued event instead of a time-zone-aware event. */
  allDay?: boolean;
  sourceUrl: string;
  metrics?: EconomicMetric[];
}

export type SourceState = "ok" | "fallback" | "unavailable";

export interface SourceStatus {
  source: "bls" | "bea" | "adp" | "dol" | "fomc" | "nasdaq-earnings" | "sp500-members" | "nasdaq100-members";
  state: SourceState;
  events: number;
  detail?: string;
  updatedAt?: string;
  coverage?: { from: string; to: string; missingDates: number };
}

export interface ValueStatus {
  provider: "fmp";
  state: "ok" | "disabled" | "unavailable";
  matchedEvents: number;
  metrics: number;
  detail?: string;
}
