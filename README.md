# 美国经济数据日历

一个运行在 Cloudflare Workers 上的公开 iCalendar 订阅服务，面向 iPhone、iPad 和 macOS 日历。

日历包含：

- 美国 CPI、PPI、PCE（含核心 PCE）
- ADP 就业报告（小非农）
- Employment Situation / NFP（大非农）
- 每周初请和续请失业金人数
- FOMC 利率决议

只提供公布日程，不提供预测值或公布后的实际值。所有事件按 `America/New_York` 创建，iOS 会自动换算到本地时区。

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
npm test
npm run typecheck
npm run dev
```

本地地址：

- 订阅说明：`http://localhost:8787/`
- 日历：`http://localhost:8787/calendar.ics`
- 数据源状态：`http://localhost:8787/health`

## 部署

先登录 Cloudflare，然后部署：

```bash
npx wrangler login
npm run deploy
```

部署完成后会得到类似下面的地址：

```text
https://us-economic-calendar.<你的 workers 子域>.workers.dev/calendar.ics
```

在 iPhone 中打开 Worker 首页并点击“在 iPhone 中订阅”，或者进入：

`设置 → App → 日历 → 日历账户 → 添加账户 → 其他 → 添加已订阅的日历`

然后粘贴 `.ics` 地址。不同 iOS 版本的设置菜单名称可能略有不同。

## 数据来源与更新

- [BLS Release Calendar](https://www.bls.gov/schedule/)：CPI、PPI、非农
- [BEA Release Schedule](https://www.bea.gov/news/schedule/)：PCE
- [ADP National Employment Report](https://adpemploymentreport.com/)：小非农
- [DOL Economic Data](https://www.dol.gov/newsroom/economicdata)：初请和续请失业金
- [Federal Reserve FOMC Calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm)：FOMC

Worker 每 6 小时更新缓存。官方页面抓取失败时，会按数据源分别使用 `src/generated.ts` 中已经核验的日程，不会让整个订阅失效。BLS、BEA 或 ADP 公布新一年度日程后，应同步更新这里的兜底记录并运行测试。失业金报告通常在周四 08:30（美国东部时间）公布；与联邦假日冲突时自动移到周三。

## 实现约定

- 事件 UID 使用数据类别和报告期，而不是公布日期；官方改期不会在订阅端制造重复事件。
- FOMC 事件记录会议最后一天 14:00 的决议公布时间，不包含会议纪要。
- 日历覆盖最近 90 天到未来 15 个月，不内置提醒。
- 订阅地址公开，无 Token、账号或数据库。
