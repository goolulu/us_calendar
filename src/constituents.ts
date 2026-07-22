export type IndexId = "sp500" | "nasdaq100";

export interface IndexMember {
  /** Nasdaq-compatible ticker (for example BRK-B rather than BRK.B). */
  symbol: string;
  companyName: string;
  industry: string;
}

export type IndexSourceState = "wikipedia" | "csv" | "snapshot";

export interface IndexDataset {
  version: 1;
  updatedAt: string;
  sp500: IndexMember[];
  nasdaq100: IndexMember[];
  sources: Record<IndexId, string>;
  states: Record<IndexId, IndexSourceState>;
}

export interface IndexSourceStatus {
  source: "sp500-members" | "nasdaq100-members";
  state: "ok" | "fallback";
  events: number;
  detail: string;
}

export const SP500_WIKIPEDIA_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies";
export const NASDAQ100_WIKIPEDIA_URL = "https://en.wikipedia.org/wiki/List_of_NASDAQ-100_companies";
export const SP500_CSV_URL = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv";
export const BUNDLED_SNAPSHOT_SOURCE = "bundled:snapshot";

export const INDEX_COUNT_RANGES: Readonly<Record<IndexId, { min: number; max: number }>> = {
  // The S&P 500 normally has 503 securities because several companies have two share classes.
  sp500: { min: 490, max: 510 },
  // The Nasdaq-100 can likewise contain slightly more than 100 securities.
  nasdaq100: { min: 95, max: 110 },
};

/** Normalize the class-share separator to the form used by Nasdaq's APIs. */
export function canonicalSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/\./g, "-");
}

// Last refreshed from the public constituent lists on 2026-07-22. These are deliberately
// symbols-only: their purpose is to keep earnings filtering available while upstream lists fail.
const SP500_SNAPSHOT = `
MMM AOS ABT ABBV ACN ADBE AMD AES AFL A APD ABNB AKAM ALB ARE ALGN ALLE LNT ALL
GOOGL GOOG MO AMZN AMCR AEE AEP AXP AIG AMT AWK AMP AME AMGN APH ADI AON APA APO
AAPL AMAT APP APTV ACGL ADM ARES ANET AJG AIZ T ATO ADSK ADP AZO AVB AVY AXON BKR
BALL BAC BAX BDX BRK.B BBY TECH BIIB BLK BX XYZ BNY BA BKNG BSX BMY AVGO BR BRO
BF.B BLDR BG BXP CHRW CDNS CPT COF CAH CCL CARR CVNA CASY CAT CBOE CBRE CDW COR
CNC CNP CF CRL SCHW CHTR CVX CMG CB CHD CIEN CI CINF CTAS CSCO C CFG CLX CME CMS
KO CTSH COHR COIN CL CMCSA FIX COP ED STZ CEG COO CPRT GLW CPAY CTVA CSGP COST CRH
CRWD CCI CSX CMI CVS DHR DRI DDOG DVA DECK DE DELL DAL DVN DXCM FANG DLR DG DLTR D
DPZ DASH DOV DOW DHI DTE DUK DD ETN EBAY ECHO ECL EIX EW EA ELV EME EMR ETR EOG
EQT EFX EQIX EQR ERIE ESS EL EG EVRG ES EXC EXE EXPE EXPD EXR XOM FFIV FDS FICO
FAST FRT FDX FDXF FIS FITB FSLR FE FISV FLEX F FTNT FTV FOXA FOX BEN FCX GRMN IT GE
GEHC GEV GEN GNRC GD GIS GM GPC GILD GPN GL GDDY GS HAL HIG HAS HCA DOC HSIC HSY
HPE HLT HD HONA HON HRL HST HWM HPQ HUBB HUM HBAN HII IBM IEX IDXX ITW INCY IR PODD
INTC IBKR ICE IFF IP INTU ISRG IVZ INVH IQV IRM JBHT JBL JKHY J JNJ JCI JPM KVUE
KDP KEY KEYS KMB KIM KMI KKR KLAC KHC KR LHX LH LRCX LVS LDOS LEN LII LLY LIN LYV
LMT L LOW LULU LITE LYB MTB MPC MAR MRSH MLM MRVL MAS MA MKC MCD MCK MDT MRK META
MET MTD MGM MCHP MU MSFT MAA MRNA TAP MDLZ MPWR MNST MCO MS MOS MSI MSCI NDAQ NTAP
NFLX NEM NWSA NWS NEE NKE NI NDSN NSC NTRS NOC NCLH NRG NUE NVDA NVR NXPI ORLY
OXY ODFL OMC ON OKE ORCL OTIS PCAR PKG PLTR PANW PSKY PH PAYX PYPL PNR PEP PFE PCG
PM PSX PNW PNC PPG PPL PFG PG PGR PLD PRU PEG PTC PSA PHM PWR QCOM DGX Q RL RJF
RTX O REG REGN RF RSG RMD RVTY HOOD ROK ROL ROP ROST RCL SPGI CRM SNDK SBAC SLB
STX SRE NOW SHW SPG SWKS SJM SW SNA SOLV SO LUV SWK SBUX STT STLD STE SYK SMCI
SYF SNPS SYY TMUS TROW TTWO TPR TRGP TGT TEL TDY TER TSLA TXN TPL TXT TMO TJX TKO
TTD TSCO TT TDG TRV TRMB TFC TYL TSN USB UBER UDR ULTA UNP UAL UPS URI UNH UHS
VLO VEEV VTR VLTO VRSN VRSK VZ VRTX VRT VTRS VICI V VST VMC WRB GWW WAB WMT DIS
WBD WM WAT WEC WFC WELL WST WDC WY WSM WMB WTW WDAY WYNN XEL XYL YUM ZBRA ZBH ZTS
`;

const NASDAQ100_SNAPSHOT = `
ADBE AMD ABNB ALNY GOOGL GOOG AMZN AEP AMGN ADI AAPL AMAT APP ARM ASML ALAB ADSK ADP
AXON BKR BKNG AVGO CDNS CTAS CSCO CCEP CMCSA CEG CPRT CRWV COST CRWD CSX DDOG DXCM
FANG DASH EA EXC FAST FER FTNT GEHC GILD HONA HON IDXX INTC INTU ISRG KDP KLAC KHC
LRCX LIN LITE MAR MRVL MELI META MCHP MU MSFT MSTR MDLZ MPWR MNST NBIS NFLX NVDA
NXPI ORLY ODFL PCAR PLTR PANW PAYX PYPL PDD PEP QCOM REGN RKLB ROP ROST SNDK STX
SHOP SPCX SBUX SNPS TMUS TTWO TER TSLA TXN TRI VRTX WMT WBD WDC WDAY XEL
`;

function symbolsFromSnapshot(value: string): readonly string[] {
  return Object.freeze(value.trim().split(/\s+/).map(canonicalSymbol));
}

export const SP500_FALLBACK_SYMBOLS = symbolsFromSnapshot(SP500_SNAPSHOT);
export const NASDAQ100_FALLBACK_SYMBOLS = symbolsFromSnapshot(NASDAQ100_SNAPSHOT);

function snapshotMembers(symbols: readonly string[]): IndexMember[] {
  return symbols.map((symbol) => ({ symbol, companyName: symbol, industry: "" }));
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanCell(value: string): string {
  return decodeHtml(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedHeader(value: string): string {
  return cleanCell(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const SYMBOL_HEADERS = new Set(["symbol", "ticker", "ticker symbol"]);
const COMPANY_HEADERS = new Set(["security", "company", "company name"]);
const INDUSTRY_HEADERS = ["gics sector", "icb industry", "industry", "sector", "gics sub industry", "icb subsector"];

function tableCells(row: string): string[] {
  return [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((match) => match[1]);
}

function membersFromTable(table: string): IndexMember[] | undefined {
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  let headerRow = -1;
  let symbolColumn = -1;
  let companyColumn = -1;
  let industryColumn = -1;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const headers = tableCells(rows[rowIndex]).map(normalizedHeader);
    const symbol = headers.findIndex((header) => SYMBOL_HEADERS.has(header));
    const company = headers.findIndex((header) => COMPANY_HEADERS.has(header));
    if (symbol < 0 || company < 0) continue;
    headerRow = rowIndex;
    symbolColumn = symbol;
    companyColumn = company;
    industryColumn = INDUSTRY_HEADERS.map((header) => headers.indexOf(header)).find((column) => column >= 0) ?? -1;
    break;
  }

  if (headerRow < 0) return undefined;
  const bySymbol = new Map<string, IndexMember>();
  const lastColumn = Math.max(symbolColumn, companyColumn, industryColumn);
  for (const row of rows.slice(headerRow + 1)) {
    const cells = tableCells(row).map(cleanCell);
    if (cells.length <= lastColumn) continue;
    const symbol = canonicalSymbol(cells[symbolColumn]);
    const companyName = cells[companyColumn];
    if (!/^[A-Z0-9][A-Z0-9-]{0,11}$/.test(symbol) || !companyName || bySymbol.has(symbol)) continue;
    const industry = industryColumn >= 0 ? cells[industryColumn] : "";
    bySymbol.set(symbol, { symbol, companyName, industry });
  }
  return [...bySymbol.values()];
}

export function validateIndexMembers(members: readonly IndexMember[], index: IndexId): void {
  const range = INDEX_COUNT_RANGES[index];
  if (members.length < range.min || members.length > range.max) {
    throw new Error(`Invalid ${index} constituent count: ${members.length}; expected ${range.min}-${range.max}`);
  }
  const symbols = new Set<string>();
  for (const member of members) {
    if (member.symbol !== canonicalSymbol(member.symbol) || !/^[A-Z0-9][A-Z0-9-]{0,11}$/.test(member.symbol)) {
      throw new Error(`Invalid ${index} constituent symbol: ${member.symbol}`);
    }
    if (symbols.has(member.symbol)) throw new Error(`Duplicate ${index} constituent symbol: ${member.symbol}`);
    symbols.add(member.symbol);
  }
}

/** Parse the constituent wikitable whose headers identify it, ignoring unrelated wikitables. */
export function parseWikipediaConstituents(html: string, index: IndexId): IndexMember[] {
  for (const match of html.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)) {
    if (!/\bclass\s*=\s*["'][^"']*\bwikitable\b[^"']*["']/i.test(match[1])) continue;
    const members = membersFromTable(match[2]);
    if (!members) continue;
    validateIndexMembers(members, index);
    return members;
  }
  throw new Error(`No ${index} constituent wikitable found`);
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (quoted) {
      if (char === '"' && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  if (value || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

/** Parse the public S&P 500 CSV fallback, including quoted names and fields. */
export function parseSp500Csv(csv: string): IndexMember[] {
  const rows = parseCsvRows(csv);
  const headers = (rows.shift() ?? []).map((header) => header.trim().toLowerCase());
  const symbolColumn = headers.findIndex((header) => SYMBOL_HEADERS.has(header));
  const companyColumn = headers.findIndex((header) => COMPANY_HEADERS.has(header));
  const industryColumn = headers.findIndex((header) => ["gics sector", "industry", "sector"].includes(header));
  if (symbolColumn < 0 || companyColumn < 0) throw new Error("S&P 500 CSV is missing Symbol and Security columns");

  const bySymbol = new Map<string, IndexMember>();
  for (const row of rows) {
    const symbol = canonicalSymbol(row[symbolColumn] ?? "");
    const companyName = row[companyColumn]?.trim();
    if (!/^[A-Z0-9][A-Z0-9-]{0,11}$/.test(symbol) || !companyName || bySymbol.has(symbol)) continue;
    const industry = industryColumn >= 0 ? row[industryColumn]?.trim() ?? "" : "";
    bySymbol.set(symbol, { symbol, companyName, industry });
  }
  const members = [...bySymbol.values()];
  validateIndexMembers(members, "sp500");
  return members;
}

interface LoadedIndex {
  members: IndexMember[];
  source: string;
  state: IndexSourceState;
}

async function fetchText(url: string, fetcher: typeof fetch, accept: string): Promise<string> {
  const response = await fetcher(url, {
    headers: {
      Accept: accept,
      "User-Agent": "us-economic-calendar/1.0 (+https://github.com/goolulu/us_calendar)",
    },
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

async function loadWikipedia(index: IndexId, fetcher: typeof fetch): Promise<LoadedIndex> {
  const source = index === "sp500" ? SP500_WIKIPEDIA_URL : NASDAQ100_WIKIPEDIA_URL;
  const html = await fetchText(source, fetcher, "text/html");
  return { members: parseWikipediaConstituents(html, index), source, state: "wikipedia" };
}

async function loadSp500(fetcher: typeof fetch): Promise<LoadedIndex> {
  try {
    return await loadWikipedia("sp500", fetcher);
  } catch {
    try {
      const csv = await fetchText(SP500_CSV_URL, fetcher, "text/csv");
      return { members: parseSp500Csv(csv), source: SP500_CSV_URL, state: "csv" };
    } catch {
      return { members: snapshotMembers(SP500_FALLBACK_SYMBOLS), source: BUNDLED_SNAPSHOT_SOURCE, state: "snapshot" };
    }
  }
}

async function loadNasdaq100(fetcher: typeof fetch): Promise<LoadedIndex> {
  try {
    return await loadWikipedia("nasdaq100", fetcher);
  } catch {
    return { members: snapshotMembers(NASDAQ100_FALLBACK_SYMBOLS), source: BUNDLED_SNAPSHOT_SOURCE, state: "snapshot" };
  }
}

/** Fetch each index independently so failure of one source never discards the other index. */
export async function fetchIndexDataset(now: Date = new Date(), fetcher: typeof fetch = fetch): Promise<IndexDataset> {
  const [sp500, nasdaq100] = await Promise.all([loadSp500(fetcher), loadNasdaq100(fetcher)]);
  return {
    version: 1,
    updatedAt: now.toISOString(),
    sp500: sp500.members,
    nasdaq100: nasdaq100.members,
    sources: { sp500: sp500.source, nasdaq100: nasdaq100.source },
    states: { sp500: sp500.state, nasdaq100: nasdaq100.state },
  };
}

/** Construct a fresh dataset from the immutable emergency snapshots. */
export function bundledIndexDataset(now: Date = new Date()): IndexDataset {
  return {
    version: 1,
    updatedAt: now.toISOString(),
    sp500: snapshotMembers(SP500_FALLBACK_SYMBOLS),
    nasdaq100: snapshotMembers(NASDAQ100_FALLBACK_SYMBOLS),
    sources: { sp500: BUNDLED_SNAPSHOT_SOURCE, nasdaq100: BUNDLED_SNAPSHOT_SOURCE },
    states: { sp500: "snapshot", nasdaq100: "snapshot" },
  };
}

/** Convert dataset provenance into the health shape used by the Worker. */
export function indexSourceStatuses(dataset: IndexDataset): IndexSourceStatus[] {
  return (["sp500", "nasdaq100"] as const).map((index) => ({
    source: index === "sp500" ? "sp500-members" : "nasdaq100-members",
    state: dataset.states[index] === "wikipedia" ? "ok" : "fallback",
    events: dataset[index].length,
    detail: dataset.sources[index],
  }));
}
