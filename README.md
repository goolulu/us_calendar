# U.S. Economic Calendar

A public iCalendar subscription service for iPhone, iPad, and macOS Calendar, deployed on Cloudflare Workers.

The calendar includes:

- U.S. CPI, PPI, and PCE releases, including Core PCE
- ADP National Employment Report
- Employment Situation / Nonfarm Payrolls (NFP)
- Weekly initial and continuing unemployment claims
- FOMC interest rate decisions

The service publishes release schedules only. It does not include market forecasts or actual values after publication. Events use the `America/New_York` time zone, and calendar clients automatically convert them to the user's local time.

## Local Development

Node.js 20 or later is required.

```bash
npm install
npm test
npm run typecheck
npm run dev
```

Local endpoints:

- Subscription page: `http://localhost:8787/`
- Calendar feed: `http://localhost:8787/calendar.ics`
- Source health: `http://localhost:8787/health`

## Deployment

Log in to Cloudflare and deploy the Worker:

```bash
npx wrangler login
npm run deploy
```

After deployment, the subscription URL will look like this:

```text
https://us-economic-calendar.<your-workers-subdomain>.workers.dev/calendar.ics
```

On an iPhone, open the Worker landing page and select **Subscribe on iPhone**. Alternatively, navigate to:

`Settings → Apps → Calendar → Calendar Accounts → Add Account → Other → Add Subscribed Calendar`

Paste the `.ics` URL into the Server field. Menu names may differ slightly between iOS versions.

## Endpoints

### `GET /calendar.ics`

Returns the public UTF-8 iCalendar feed. The response is cached for six hours and includes the `text/calendar` content type.

### `GET /health`

Returns the generation time, number of available events, and the status of each upstream source. A source can have one of these states:

- `ok`: live official schedule data was available
- `fallback`: the verified local schedule was used
- `unavailable`: neither live nor fallback data was available

### `GET /`

Returns a small landing page containing a `webcal://` subscription link and the HTTPS calendar URL.

## Data Sources

- [BLS Release Calendar](https://www.bls.gov/schedule/) for CPI, PPI, and NFP
- [BEA Release Schedule](https://www.bea.gov/news/schedule/) for PCE
- [ADP National Employment Report](https://adpemploymentreport.com/) for private employment
- [DOL Economic Data](https://www.dol.gov/newsroom/economicdata) for unemployment claims
- [Federal Reserve FOMC Calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm) for rate decisions

The Worker refreshes its cached output every six hours. If an official page cannot be reached or parsed, that source independently falls back to the verified schedule in `src/generated.ts`, so one upstream failure does not break the entire feed.

When BLS, BEA, or ADP publishes a new annual schedule, update the fallback records in `src/generated.ts` and run the test suite. Weekly unemployment claims are normally scheduled for Thursday at 8:30 a.m. Eastern Time. A release that conflicts with a federal holiday is moved to Wednesday.

## Calendar Behavior

- Event UIDs are based on the release category and reporting period rather than the publication date. Rescheduled releases therefore update the existing event instead of creating duplicates.
- FOMC events represent the interest rate decision at 2:00 p.m. Eastern Time on the final meeting day. FOMC minutes are not included.
- The feed covers the previous 90 days and the next 15 months.
- Events do not contain forced alarms or reminders.
- The feed is public and does not require a token, account, or database.

## Testing

Run all automated checks with:

```bash
npm test
npm run typecheck
npx wrangler deploy --dry-run
```

The tests cover official schedule parsing, source-specific fallback behavior, stable event identifiers, unemployment-claims holiday adjustments, iCalendar line folding, UTF-8 content, and CRLF formatting.
