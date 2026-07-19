export type Category = "cpi" | "ppi" | "pce" | "nfp" | "adp" | "claims" | "fomc";

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
  title: string;
  description: string;
  start: string; // America/New_York local time, YYYY-MM-DDTHH:mm
  durationMinutes: number;
  sourceUrl: string;
  metrics?: EconomicMetric[];
}

export type SourceState = "ok" | "fallback" | "unavailable";

export interface SourceStatus {
  source: "bls" | "bea" | "adp" | "dol" | "fomc";
  state: SourceState;
  events: number;
  detail?: string;
}

export interface ValueStatus {
  provider: "fmp";
  state: "ok" | "disabled" | "unavailable";
  matchedEvents: number;
  metrics: number;
  detail?: string;
}
