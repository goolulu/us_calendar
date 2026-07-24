# U.S. Economic & Earnings Calendar

A public iCalendar subscription service for iPhone, iPad, and macOS Calendar, deployed on Cloudflare Workers. One feed combines U.S. economic releases with earnings announcements for companies in the S&P 500 and Nasdaq-100. The landing page lets each subscriber search and select the companies they want in a personal feed.

## Live Calendar

Subscribe using the public calendar URL:

**[https://us-calendar.hrn961110.workers.dev/calendar.ics](https://us-calendar.hrn961110.workers.dev/calendar.ics)**

On Apple devices, you can also open this one-click subscription link:

**[Subscribe in Apple Calendar](webcal://us-calendar.hrn961110.workers.dev/calendar.ics)**

Open the Worker root URL to manage a smaller personalized feed. Stock selections are saved in the browser and encoded in the subscription URL; they never replace the complete constituent, earnings, event, and ICS snapshots stored in KV.

The calendar includes:

- U.S. CPI, PPI, and PCE releases, including Core PCE
- ADP National Employment Report
- Employment Situation / Nonfarm Payrolls (NFP)
- Weekly initial and continuing unemployment claims
- FOMC interest rate decisions
- Earnings announcements for S&P 500 and Nasdaq-100 constituents

Official agency schedules determine economic release times. When an FMP API key is configured during snapshot generation, economic event descriptions are enriched with selected previous and actual values. Earnings dates and sessions are estimates and can change. Events use the `America/New_York` time zone, and calendar clients automatically convert them to the user's local time.

## Local Development

Node.js 20 or later is required.

```bash
npm install
npm run seed:earnings -- --local
npm test
npm run typecheck
npm run dev
```

The local seed is optional when working only on the economic calendar, but it is required to preview earnings events. It writes only to Wrangler's ignored local state directory. The seed reads the optional `FMP_API_KEY` environment variable when value enrichment is wanted.

Local endpoints:

- Subscription page: `http://localhost:8787/`
- Stock catalog API: `http://localhost:8787/api/stocks`
- Calendar feed: `http://localhost:8787/calendar.ics`
- Source health: `http://localhost:8787/health`

## Deployment

Log in to Cloudflare and deploy the Worker. Wrangler automatically provisions the `EARNINGS_DATA` KV namespace declared in `wrangler.toml`, so no account-specific KV namespace ID needs to be committed:

```bash
npx wrangler login
npm run deploy
npm run seed:earnings
```

Run the commands in that order: deploy first, then seed manually once. The seed command initializes the constituent lists, the complete earnings window, optional economic values, and the generated calendar snapshot in the remote KV namespace.

`FMP_API_KEY` is optional. Set it in the seed process environment to add previous and actual values to generated snapshots. You can also run `npx wrangler secret put FMP_API_KEY` so value enrichment remains available if the Worker must generate a degraded fallback response. Without the key, or whenever FMP is unavailable, the calendar continues publishing schedules without values. Never add the key to `wrangler.toml` or commit it.

### Automated earnings refresh

The repository includes a GitHub Actions workflow that runs `npm run seed:earnings` every day at 06:34 and 18:34 UTC. It can also be started manually with **Actions → Refresh calendar → Run workflow**. Before enabling it, add these repository Actions secrets under **Settings → Secrets and variables → Actions**:

- `CLOUDFLARE_API_TOKEN`: an account-scoped, least-privilege token with `Workers KV Storage: Write` and `Workers Scripts: Read`; the latter lets Wrangler resolve the auto-provisioned binding from the deployed Worker
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account that owns the Worker and KV namespace
- `FMP_API_KEY`: optional; enriches economic events in generated snapshots

Each workflow run fetches the full earnings window and publishes all KV records in one bulk operation. The publish includes the full structured event snapshot as well as the prebuilt full ICS; per-user stock selection is applied only when a calendar is requested. If any earnings date fails, the job refuses to publish, so the last complete snapshot remains available. Fetching and generation therefore run in GitHub Actions instead of a Worker Cron invocation, keeping the Worker request path within Workers Free CPU limits.

[GitHub automatically disables scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) in a public repository after 60 days without repository activity. Monitor `/health` and the **Actions** page; if this repository becomes inactive, re-enable the workflow manually or move the schedule to an external runner.

After deployment, the subscription URL will look like this:

```text
https://us-calendar.<your-workers-subdomain>.workers.dev/calendar.ics
```

On an iPhone, open the Worker landing page and select **Subscribe on iPhone**. Alternatively, navigate to:

`Settings → Apps → Calendar → Calendar Accounts → Add Account → Other → Add Subscribed Calendar`

Paste the `.ics` URL into the Server field. Menu names may differ slightly between iOS versions.

```text
https://us-calendar.hrn961110.workers.dev/calendar.ics
```

## Endpoints

### `GET /calendar.ics`

Returns the public UTF-8 iCalendar feed containing economic releases and qualifying S&P 500/Nasdaq-100 earnings announcements. The response includes the `text/calendar` content type.

With no query parameter, this endpoint preserves the original all-stock feed. A personalized feed uses a comma-separated `stocks` query parameter:

```text
https://us-calendar.hrn961110.workers.dev/calendar.ics?stocks=AAPL,MSFT,NVDA
```

`stocks=NONE` (or an explicitly empty `stocks=` value) returns economic releases without company earnings. Economic releases are always included in personalized feeds.

### `GET /api/stocks`

Returns the deduplicated stock catalog used by the management page, including company names, industries, and S&P 500/Nasdaq-100 membership. It reads the latest full constituent snapshot from KV and falls back to the bundled symbol list if KV is unavailable.

### `GET /health`

Returns the generation time, number of events, schedule-source status, earnings coverage, constituent freshness, and FMP value coverage. Schedule and earnings sources use these states:

- `ok`: the latest upstream data was available
- `fallback`: cached, secondary, or bundled data was used
- `unavailable`: neither current nor fallback data was available

### `GET /`

Returns the stock subscription management page.

## Data Sources

- [BLS Release Calendar](https://www.bls.gov/schedule/) for CPI, PPI, and NFP
- [BEA Release Schedule](https://www.bea.gov/news/schedule/) for PCE
- [ADP National Employment Report](https://adpemploymentreport.com/) for private employment
- [DOL Economic Data](https://www.dol.gov/newsroom/economicdata) for unemployment claims
- [Federal Reserve FOMC Calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm) for rate decisions
- [Financial Modeling Prep Economic Calendar](https://site.financialmodelingprep.com/developer/docs/stable/economics-calendar) for optional previous and actual values
- [Nasdaq Earnings Calendar](https://www.nasdaq.com/market-activity/earnings) for estimated company earnings dates and sessions
- [Wikipedia list of S&P 500 companies](https://en.wikipedia.org/wiki/List_of_S%26P_500_companies) and [Nasdaq-100](https://en.wikipedia.org/wiki/Nasdaq-100) for index membership

Economic schedule sources retain their independent fallback data in `src/generated.ts`, so one upstream failure does not break the entire feed. GitHub Actions refreshes the full earnings window and index membership twice daily, then uploads the generated KV records as one batch. The most recent successful earnings snapshot remains available when an upstream request fails.

FMP data is requested in 90-day ranges. It only enriches an event after a known U.S. indicator name and release date match, and it never overrides the official release time or source. The free plan and endpoint access can change; confirm that your FMP account permits the endpoint and your intended use before publishing the enriched feed.

When BLS, BEA, or ADP publishes a new annual schedule, update the fallback records in `src/generated.ts` and run the test suite. Weekly unemployment claims are normally scheduled for Thursday at 8:30 a.m. Eastern Time. A release that conflicts with a federal holiday is moved to Wednesday.

## Calendar Behavior

- Event UIDs are based on the release category and reporting period rather than the publication date. Rescheduled releases therefore update the existing event instead of creating duplicates.
- Previous and actual values can appear in economic event descriptions. FMP forecast values are intentionally not included.
- FOMC events represent the interest rate decision at 2:00 p.m. Eastern Time on the final meeting day. FOMC minutes are not included.
- Economic events cover the previous 90 days and the next 15 months. Earnings events cover the previous 30 days through the next 30 days.
- Earnings reported as before market open are placed at approximately 8:00 a.m. Eastern Time; after-market announcements are placed at approximately 4:00 p.m. Eastern Time. Announcements without a known session are all-day events.
- A company present in both the S&P 500 and Nasdaq-100 appears only once, with both memberships shown in its event details.
- Personalized stock selections filter only the response. Scheduled refreshes still fetch and publish the full index and earnings datasets to KV.
- The management page keeps selections in local browser storage and in the generated subscription URL; it does not create per-user KV records.
- Events do not contain forced alarms or reminders.
- The feed is public and does not require a token or account. Cloudflare KV stores earnings data and the generated feed snapshot.

## Testing

Run all automated checks with:

```bash
npm test
npm run typecheck
npx wrangler deploy --dry-run
```

The tests cover economic schedules and value enrichment, Nasdaq earnings normalization, index parsing and fallbacks, stable identifiers, overlapping-index deduplication, KV snapshots, approximate reporting sessions, all-day events, iCalendar line folding, UTF-8 content, and CRLF formatting.

## Acknowledgements

The rolling earnings-calendar approach was inspired by [OhEarningsCal](https://github.com/jason5ng32/OhEarningsCal).
