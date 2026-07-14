export type Category = "cpi" | "ppi" | "pce" | "nfp" | "adp" | "claims" | "fomc";

export interface CalendarEvent {
  /** Stable identity. It must not change when an agency reschedules a release. */
  id: string;
  category: Category;
  title: string;
  description: string;
  start: string; // America/New_York local time, YYYY-MM-DDTHH:mm
  durationMinutes: number;
  sourceUrl: string;
}

export type SourceState = "ok" | "fallback" | "unavailable";

export interface SourceStatus {
  source: "bls" | "bea" | "adp" | "dol" | "fomc";
  state: SourceState;
  events: number;
  detail?: string;
}
