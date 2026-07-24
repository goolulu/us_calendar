export function managementPage(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="theme-color" content="#102720">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='18' fill='%23102720'/%3E%3Cpath d='M18 24h28v24H18zM23 16v10m18-10v10M18 31h28' fill='none' stroke='%23fff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='m25 39 5 5 10-11' fill='none' stroke='%23c9ed78' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
  <title>我的财报日历｜股票订阅管理</title>
  <style>
    :root {
      --ink: #102720;
      --ink-soft: #456059;
      --paper: #f3f5ef;
      --surface: #ffffff;
      --line: #dfe5dd;
      --line-strong: #cad4ca;
      --green: #1f7558;
      --green-dark: #14533e;
      --green-soft: #e5f2ec;
      --lime: #c9ed78;
      --blue: #e6efff;
      --blue-ink: #295690;
      --shadow: 0 24px 70px rgba(16, 39, 32, .11);
      --radius: 22px;
    }

    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-width: 320px;
      background:
        linear-gradient(rgba(16, 39, 32, .035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(16, 39, 32, .035) 1px, transparent 1px),
        var(--paper);
      background-size: 32px 32px;
      color: var(--ink);
      font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI",
        "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      font-size: 15px;
      line-height: 1.5;
    }

    button, input { font: inherit; }
    button, a { -webkit-tap-highlight-color: transparent; }
    button:focus-visible, a:focus-visible, input:focus-visible {
      outline: 3px solid rgba(31, 117, 88, .24);
      outline-offset: 2px;
    }

    .shell { width: min(1240px, calc(100% - 40px)); margin: 0 auto; }
    .topbar {
      height: 76px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 11px;
      color: var(--ink);
      text-decoration: none;
      font-weight: 780;
      letter-spacing: -.02em;
    }
    .brand-mark {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      color: white;
      background: var(--ink);
      box-shadow: 0 8px 20px rgba(16, 39, 32, .18);
    }
    .brand-mark svg { width: 20px; height: 20px; }
    .sync-pill {
      min-height: 34px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 12px;
      border: 1px solid var(--line-strong);
      border-radius: 999px;
      color: var(--ink-soft);
      background: rgba(255,255,255,.72);
      font-size: 12px;
      font-weight: 650;
      backdrop-filter: blur(10px);
    }
    .sync-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #37a777;
      box-shadow: 0 0 0 4px rgba(55, 167, 119, .13);
    }

    .hero {
      position: relative;
      overflow: hidden;
      min-height: 316px;
      padding: 48px 54px;
      border-radius: 30px;
      color: white;
      background: var(--ink);
      box-shadow: var(--shadow);
    }
    .hero::before {
      content: "";
      position: absolute;
      width: 420px;
      height: 420px;
      top: -230px;
      right: -90px;
      border: 1px solid rgba(201, 237, 120, .28);
      border-radius: 50%;
      box-shadow:
        0 0 0 54px rgba(201, 237, 120, .035),
        0 0 0 108px rgba(201, 237, 120, .025);
    }
    .hero::after {
      content: "SELECT";
      position: absolute;
      right: 32px;
      bottom: -35px;
      color: rgba(255,255,255,.035);
      font-size: clamp(92px, 14vw, 168px);
      font-weight: 900;
      letter-spacing: -.08em;
      line-height: 1;
      pointer-events: none;
    }
    .hero-copy { position: relative; z-index: 1; max-width: 700px; }
    .eyebrow {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 19px;
      color: var(--lime);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .16em;
      text-transform: uppercase;
    }
    .eyebrow::before { content: ""; width: 28px; height: 1px; background: currentColor; }
    h1 {
      max-width: 670px;
      margin: 0;
      font-size: clamp(38px, 5.3vw, 64px);
      line-height: 1.08;
      letter-spacing: -.055em;
      font-weight: 800;
    }
    h1 span { color: var(--lime); }
    .hero p {
      max-width: 650px;
      margin: 22px 0 0;
      color: rgba(255,255,255,.72);
      font-size: 16px;
      line-height: 1.75;
    }
    .hero-facts {
      position: absolute;
      z-index: 2;
      right: 36px;
      bottom: 30px;
      display: flex;
      gap: 10px;
    }
    .hero-fact {
      min-width: 110px;
      padding: 14px 16px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 16px;
      background: rgba(255,255,255,.07);
      backdrop-filter: blur(12px);
    }
    .hero-fact strong { display: block; font-size: 20px; line-height: 1.1; }
    .hero-fact small { color: rgba(255,255,255,.58); font-size: 11px; }

    .workspace {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 350px;
      gap: 20px;
      align-items: start;
      margin: 22px 0 60px;
    }
    .panel {
      border: 1px solid rgba(202, 212, 202, .85);
      border-radius: var(--radius);
      background: var(--surface);
      box-shadow: 0 12px 42px rgba(16, 39, 32, .065);
    }
    .catalog-panel { min-width: 0; overflow: hidden; }
    .panel-heading {
      padding: 27px 28px 22px;
      border-bottom: 1px solid var(--line);
    }
    .heading-line {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 20px;
    }
    h2, h3, p { margin-top: 0; }
    h2 { margin-bottom: 5px; font-size: 22px; letter-spacing: -.035em; }
    .subtle { margin-bottom: 0; color: #70827d; font-size: 13px; }
    .result-count {
      flex: none;
      min-width: 82px;
      padding: 7px 11px;
      border-radius: 10px;
      color: var(--green-dark);
      background: var(--green-soft);
      text-align: center;
      font-size: 12px;
      font-weight: 750;
    }

    .search-wrap { position: relative; }
    .search-wrap svg {
      position: absolute;
      left: 14px;
      top: 50%;
      width: 18px;
      height: 18px;
      color: #72827d;
      transform: translateY(-50%);
      pointer-events: none;
    }
    .search-input {
      width: 100%;
      height: 48px;
      padding: 0 44px;
      border: 1px solid var(--line-strong);
      border-radius: 14px;
      color: var(--ink);
      background: #f8faf7;
      transition: border-color .16s, box-shadow .16s, background .16s;
    }
    .search-input::placeholder { color: #87958f; }
    .search-input:focus {
      border-color: var(--green);
      outline: none;
      background: white;
      box-shadow: 0 0 0 4px rgba(31, 117, 88, .1);
    }
    .shortcut {
      position: absolute;
      right: 12px;
      top: 50%;
      padding: 2px 7px;
      border: 1px solid var(--line);
      border-radius: 6px;
      color: #8b9994;
      background: white;
      font-size: 10px;
      transform: translateY(-50%);
    }

    .filter-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-top: 16px;
    }
    .tabs {
      display: flex;
      gap: 3px;
      padding: 3px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #f4f7f3;
    }
    .tab {
      min-height: 34px;
      padding: 7px 12px;
      border: 0;
      border-radius: 9px;
      color: #667a73;
      background: transparent;
      font-size: 12px;
      font-weight: 680;
      cursor: pointer;
      white-space: nowrap;
    }
    .tab[aria-selected="true"] {
      color: var(--ink);
      background: white;
      box-shadow: 0 2px 7px rgba(16,39,32,.08);
    }
    .bulk-actions { display: flex; gap: 7px; }
    .text-button {
      padding: 7px 8px;
      border: 0;
      color: var(--green);
      background: transparent;
      font-size: 12px;
      font-weight: 720;
      cursor: pointer;
    }
    .text-button:hover { text-decoration: underline; }
    .text-button.muted { color: #75867f; }

    .stock-table-head {
      display: grid;
      grid-template-columns: 42px minmax(110px, .7fr) minmax(220px, 1.65fr) minmax(120px, .8fr);
      align-items: center;
      min-height: 43px;
      padding: 0 28px;
      border-bottom: 1px solid var(--line);
      color: #8a9792;
      background: #fafbf9;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .stock-list {
      max-height: 596px;
      min-height: 320px;
      overflow: auto;
      overscroll-behavior: contain;
      scrollbar-color: #cbd5cd transparent;
      scrollbar-width: thin;
    }
    .stock-row {
      position: relative;
      display: grid;
      grid-template-columns: 42px minmax(110px, .7fr) minmax(220px, 1.65fr) minmax(120px, .8fr);
      align-items: center;
      min-height: 66px;
      padding: 8px 28px;
      border-bottom: 1px solid #edf0ec;
      cursor: pointer;
      transition: background .14s;
    }
    .stock-row:hover { background: #f7faf7; }
    .stock-row.is-selected { background: #f1f8f4; }
    .stock-row.is-selected::before {
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      width: 3px;
      background: var(--green);
    }
    .stock-row input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }
    .check {
      width: 21px;
      height: 21px;
      display: grid;
      place-items: center;
      border: 1.5px solid #b9c5bc;
      border-radius: 7px;
      color: white;
      background: white;
      transition: .14s;
    }
    .check svg { width: 13px; height: 13px; opacity: 0; transform: scale(.6); transition: .14s; }
    .stock-row input:checked + .check { border-color: var(--green); background: var(--green); }
    .stock-row input:checked + .check svg { opacity: 1; transform: scale(1); }
    .stock-row input:focus-visible + .check { outline: 3px solid rgba(31,117,88,.22); outline-offset: 2px; }
    .ticker { font-size: 15px; font-weight: 820; letter-spacing: -.015em; }
    .company { min-width: 0; padding-right: 20px; }
    .company-name {
      display: block;
      overflow: hidden;
      color: #314941;
      font-size: 13px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .industry {
      display: block;
      overflow: hidden;
      margin-top: 2px;
      color: #93a099;
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .badges { display: flex; flex-wrap: wrap; gap: 5px; }
    .badge {
      padding: 3px 7px;
      border-radius: 7px;
      color: #445b54;
      background: #edf1ed;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: .025em;
      white-space: nowrap;
    }
    .badge.nasdaq { color: var(--blue-ink); background: var(--blue); }
    .state-message {
      min-height: 320px;
      display: grid;
      place-items: center;
      padding: 40px;
      color: #73847e;
      text-align: center;
    }
    .state-message[hidden] { display: none; }
    .loader {
      width: 30px;
      height: 30px;
      margin: 0 auto 13px;
      border: 3px solid #dfe8e1;
      border-top-color: var(--green);
      border-radius: 50%;
      animation: spin .8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .subscription-panel {
      position: sticky;
      top: 18px;
      overflow: hidden;
    }
    .subscription-top {
      padding: 27px 25px 22px;
      color: white;
      background: var(--ink);
    }
    .subscription-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      color: rgba(255,255,255,.58);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .13em;
      text-transform: uppercase;
    }
    .live-tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 7px;
      border-radius: 999px;
      color: var(--lime);
      background: rgba(201,237,120,.1);
      letter-spacing: .04em;
    }
    .selected-number {
      display: flex;
      align-items: baseline;
      gap: 7px;
      margin-bottom: 6px;
    }
    .selected-number strong { color: var(--lime); font-size: 45px; line-height: 1; letter-spacing: -.06em; }
    .selected-number span { color: rgba(255,255,255,.74); font-weight: 650; }
    .subscription-top p { margin: 0; color: rgba(255,255,255,.58); font-size: 12px; }
    .selection-preview {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-height: 28px;
      margin-top: 17px;
    }
    .selection-chip {
      padding: 5px 8px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 8px;
      color: rgba(255,255,255,.86);
      background: rgba(255,255,255,.07);
      font-size: 10px;
      font-weight: 750;
    }
    .selection-empty { color: rgba(255,255,255,.42); font-size: 11px; }

    .subscription-body { padding: 23px 24px 25px; }
    .include-list {
      display: grid;
      gap: 10px;
      margin-bottom: 20px;
    }
    .include-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      color: #50665f;
      font-size: 12px;
    }
    .include-name { display: inline-flex; align-items: center; gap: 9px; }
    .include-icon {
      width: 27px;
      height: 27px;
      display: grid;
      place-items: center;
      border-radius: 9px;
      color: var(--green);
      background: var(--green-soft);
    }
    .include-icon svg { width: 14px; height: 14px; }
    .include-row strong { color: var(--ink); font-size: 11px; }
    .always-tag {
      padding: 3px 6px;
      border-radius: 6px;
      color: #62746e !important;
      background: #eff2ef;
      font-size: 9px !important;
      letter-spacing: .04em;
    }

    .url-label {
      display: block;
      margin-bottom: 7px;
      color: #6f817a;
      font-size: 10px;
      font-weight: 760;
      letter-spacing: .07em;
      text-transform: uppercase;
    }
    .url-wrap { position: relative; margin-bottom: 10px; }
    .url-field {
      width: 100%;
      height: 43px;
      padding: 0 40px 0 11px;
      border: 1px solid var(--line);
      border-radius: 11px;
      color: #536861;
      background: #f6f8f5;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10px;
    }
    .copy-icon {
      position: absolute;
      right: 5px;
      top: 5px;
      width: 33px;
      height: 33px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 8px;
      color: #60736c;
      background: transparent;
      cursor: pointer;
    }
    .copy-icon:hover { color: var(--green); background: var(--green-soft); }
    .copy-icon svg { width: 16px; height: 16px; }
    .primary-button, .secondary-button {
      width: 100%;
      min-height: 47px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 9px;
      border-radius: 13px;
      text-decoration: none;
      font-weight: 760;
      cursor: pointer;
      transition: transform .14s, box-shadow .14s, background .14s;
    }
    .primary-button {
      border: 1px solid var(--green);
      color: white;
      background: var(--green);
      box-shadow: 0 10px 22px rgba(31,117,88,.18);
    }
    .primary-button:hover { background: var(--green-dark); transform: translateY(-1px); }
    .primary-button svg { width: 17px; height: 17px; }
    .secondary-button {
      margin-top: 8px;
      border: 1px solid var(--line-strong);
      color: #536961;
      background: white;
      font-size: 12px;
    }
    .secondary-button:hover { border-color: #acbbb0; background: #f8faf7; }
    .privacy-note {
      display: flex;
      gap: 7px;
      margin: 13px 2px 0;
      color: #899790;
      font-size: 10px;
      line-height: 1.55;
    }
    .privacy-note svg { flex: none; width: 13px; height: 13px; margin-top: 1px; }
    .flow-note {
      padding: 20px 24px 22px;
      border-top: 1px solid var(--line);
      background: #fafbf9;
    }
    .flow-note h3 {
      margin-bottom: 12px;
      color: #586d65;
      font-size: 11px;
      letter-spacing: .04em;
    }
    .flow {
      display: grid;
      grid-template-columns: 1fr auto 1fr auto 1fr;
      align-items: center;
      gap: 5px;
    }
    .flow-step { color: #77877f; text-align: center; font-size: 9px; }
    .flow-step strong { display: block; margin-bottom: 3px; color: var(--ink); font-size: 10px; }
    .flow-arrow { color: #a5b2ac; }

    .toast {
      position: fixed;
      z-index: 20;
      left: 50%;
      bottom: 24px;
      padding: 11px 16px;
      border-radius: 12px;
      color: white;
      background: var(--ink);
      box-shadow: 0 12px 34px rgba(16,39,32,.25);
      font-size: 12px;
      font-weight: 680;
      opacity: 0;
      transform: translate(-50%, 12px);
      pointer-events: none;
      transition: .2s;
    }
    .toast.show { opacity: 1; transform: translate(-50%, 0); }

    @media (max-width: 980px) {
      .hero { padding: 42px; }
      .hero-facts { display: none; }
      .workspace { grid-template-columns: 1fr; }
      .subscription-panel { position: static; display: grid; grid-template-columns: 1fr 1.35fr; }
      .subscription-top { display: flex; flex-direction: column; justify-content: center; }
      .flow-note { grid-column: 1 / -1; }
    }
    @media (max-width: 700px) {
      .shell { width: min(100% - 24px, 1240px); }
      .topbar { height: 64px; }
      .brand span:last-child { display: none; }
      .sync-pill { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .hero { min-height: 0; padding: 36px 25px 38px; border-radius: 22px; }
      h1 { font-size: clamp(36px, 12vw, 50px); }
      .hero p { font-size: 14px; }
      .workspace { margin-top: 13px; }
      .panel { border-radius: 18px; }
      .panel-heading { padding: 22px 18px 18px; }
      .heading-line { margin-bottom: 16px; }
      .filter-bar { align-items: flex-start; flex-direction: column; }
      .tabs { width: 100%; overflow-x: auto; }
      .tab { flex: 1; }
      .bulk-actions { align-self: flex-end; margin-top: -5px; }
      .stock-table-head { display: none; }
      .stock-list { max-height: 520px; }
      .stock-row {
        grid-template-columns: 38px 72px minmax(0, 1fr);
        min-height: 72px;
        padding: 9px 17px;
      }
      .badges { grid-column: 3; margin-top: -10px; }
      .company { padding-right: 0; }
      .industry { display: none; }
      .subscription-panel { display: block; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="财报日历首页">
        <span class="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3v3m10-3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m8 14 2.2 2.2L16 11" stroke="#c9ed78" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <span>我的财报日历</span>
      </a>
      <div class="sync-pill" title="成分股与财报数据定时全量同步到 Cloudflare KV">
        <span class="sync-dot"></span>
        <span id="syncText">正在读取全量股票目录…</span>
      </div>
    </header>

    <main>
      <section class="hero">
        <div class="hero-copy">
          <div class="eyebrow">Personal earnings calendar</div>
          <h1>让财报日历，<br><span>只留下你关心的公司。</span></h1>
          <p>后台仍会全量同步 S&amp;P 500 与 Nasdaq-100 的成分股和财报到 KV。你在这里的勾选，只决定个人订阅源里显示哪些公司。</p>
        </div>
        <div class="hero-facts" aria-hidden="true">
          <div class="hero-fact"><strong id="heroTotal">—</strong><small>只股票可选</small></div>
          <div class="hero-fact"><strong>2×/日</strong><small>全量数据刷新</small></div>
        </div>
      </section>

      <div class="workspace">
        <section class="panel catalog-panel" aria-labelledby="catalogTitle">
          <div class="panel-heading">
            <div class="heading-line">
              <div>
                <h2 id="catalogTitle">选择关注的公司</h2>
                <p class="subtle">按代码、公司名称或行业搜索，勾选后订阅链接会立即更新。</p>
              </div>
              <span class="result-count" id="resultCount">读取中</span>
            </div>

            <div class="search-wrap">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              <input class="search-input" id="searchInput" type="search" autocomplete="off" placeholder="搜索 AAPL、Apple 或 Technology…" aria-label="搜索股票">
              <span class="shortcut" aria-hidden="true">⌘ K</span>
            </div>

            <div class="filter-bar">
              <div class="tabs" role="tablist" aria-label="筛选股票所属指数">
                <button class="tab" type="button" data-filter="all" role="tab" aria-selected="true">全部</button>
                <button class="tab" type="button" data-filter="sp500" role="tab" aria-selected="false">S&amp;P 500</button>
                <button class="tab" type="button" data-filter="nasdaq100" role="tab" aria-selected="false">Nasdaq-100</button>
                <button class="tab" type="button" data-filter="selected" role="tab" aria-selected="false">已选择</button>
              </div>
              <div class="bulk-actions">
                <button class="text-button" type="button" id="selectVisible">全选当前结果</button>
                <button class="text-button muted" type="button" id="clearSelected">清空</button>
              </div>
            </div>
          </div>

          <div class="stock-table-head" aria-hidden="true">
            <span></span><span>代码</span><span>公司 / 行业</span><span>所属指数</span>
          </div>
          <div class="stock-list" id="stockList" aria-live="polite"></div>
          <div class="state-message" id="loadingState">
            <div><div class="loader"></div><strong>正在载入全量成分股</strong><br><span class="subtle">数据来自 KV 中的最新同步快照</span></div>
          </div>
          <div class="state-message" id="emptyState" hidden>
            <div><strong>没有找到匹配的公司</strong><br><span class="subtle">换个代码、名称或行业试试</span></div>
          </div>
        </section>

        <aside class="panel subscription-panel" aria-label="我的订阅">
          <div class="subscription-top">
            <div class="subscription-label">
              <span>My subscription</span>
              <span class="live-tag">● 实时更新</span>
            </div>
            <div class="selected-number">
              <strong id="selectedCount">0</strong>
              <span>只股票</span>
            </div>
            <p id="selectionDescription">当前将仅订阅经济数据</p>
            <div class="selection-preview" id="selectionPreview">
              <span class="selection-empty">尚未选择公司</span>
            </div>
          </div>

          <div class="subscription-body">
            <div class="include-list">
              <div class="include-row">
                <span class="include-name">
                  <span class="include-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19V9m7 10V5m7 14v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
                  美国经济数据
                </span>
                <strong class="always-tag">始终包含</strong>
              </div>
              <div class="include-row">
                <span class="include-name">
                  <span class="include-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 18 9 13l3 3 7-8M15 8h4v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                  自选公司财报
                </span>
                <strong id="earningsCount">0 家</strong>
              </div>
            </div>

            <label class="url-label" for="subscriptionUrl">专属订阅地址</label>
            <div class="url-wrap">
              <input class="url-field" id="subscriptionUrl" readonly aria-describedby="privacyNote">
              <button class="copy-icon" id="copyIcon" type="button" aria-label="复制订阅地址" title="复制订阅地址">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.7"/></svg>
              </button>
            </div>
            <a class="primary-button" id="subscribeButton" href="#">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M8 3v4m8-4v4M4 10h16m-8 3v5m-2.5-2.5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              添加到 Apple 日历
            </a>
            <button class="secondary-button" id="copyButton" type="button">复制 HTTPS 地址</button>
            <p class="privacy-note" id="privacyNote">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.7"/></svg>
              <span>选择只保存在当前浏览器和订阅 URL 中，不会覆盖 KV 里的全量数据。</span>
            </p>
          </div>

          <div class="flow-note">
            <h3>数据如何流转</h3>
            <div class="flow" aria-label="全量抓取到个性化订阅的数据流程">
              <span class="flow-step"><strong>全量抓取</strong>两大指数</span>
              <span class="flow-arrow">→</span>
              <span class="flow-step"><strong>完整 KV</strong>统一快照</span>
              <span class="flow-arrow">→</span>
              <span class="flow-step"><strong>按需输出</strong>个人日历</span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  </div>

  <div class="toast" id="toast" role="status" aria-live="polite"></div>

  <script>
    (function () {
      "use strict";

      var STORAGE_KEY = "us-calendar-selected-stocks-v1";
      var state = { stocks: [], selected: new Set(), filter: "all", query: "", ready: false };
      var list = document.getElementById("stockList");
      var loading = document.getElementById("loadingState");
      var empty = document.getElementById("emptyState");
      var search = document.getElementById("searchInput");
      var resultCount = document.getElementById("resultCount");
      var selectedCount = document.getElementById("selectedCount");
      var earningsCount = document.getElementById("earningsCount");
      var selectionDescription = document.getElementById("selectionDescription");
      var selectionPreview = document.getElementById("selectionPreview");
      var subscriptionUrl = document.getElementById("subscriptionUrl");
      var subscribeButton = document.getElementById("subscribeButton");
      var toast = document.getElementById("toast");
      var toastTimer;

      function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (char) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
        });
      }

      function readSelection() {
        try {
          var value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
          return new Set(Array.isArray(value) ? value.filter(function (symbol) {
            return typeof symbol === "string";
          }) : []);
        } catch (_) {
          return new Set();
        }
      }

      function saveSelection() {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(state.selected).sort()));
        } catch (_) {}
      }

      function visibleStocks() {
        var query = state.query.trim().toLocaleLowerCase();
        return state.stocks.filter(function (stock) {
          var inFilter = state.filter === "all"
            || state.filter === "selected" && state.selected.has(stock.symbol)
            || stock.indices.indexOf(state.filter) >= 0;
          if (!inFilter) return false;
          if (!query) return true;
          return [stock.symbol, stock.companyName, stock.industry].join(" ").toLocaleLowerCase().indexOf(query) >= 0;
        });
      }

      function stockRow(stock) {
        var checked = state.selected.has(stock.symbol);
        var companyName = stock.companyName === stock.symbol ? "公司名称暂不可用" : stock.companyName;
        var industry = stock.industry || "行业信息暂不可用";
        var badges = stock.indices.map(function (index) {
          return index === "sp500"
            ? '<span class="badge">S&amp;P 500</span>'
            : '<span class="badge nasdaq">NASDAQ 100</span>';
        }).join("");
        return '<label class="stock-row' + (checked ? " is-selected" : "") + '" data-symbol="' + escapeHtml(stock.symbol) + '">'
          + '<input type="checkbox" value="' + escapeHtml(stock.symbol) + '"' + (checked ? " checked" : "") + ' aria-label="订阅 ' + escapeHtml(stock.symbol) + ' ' + escapeHtml(companyName) + '">'
          + '<span class="check"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 8 3 3 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
          + '<span class="ticker">' + escapeHtml(stock.symbol) + '</span>'
          + '<span class="company"><span class="company-name">' + escapeHtml(companyName) + '</span><span class="industry">' + escapeHtml(industry) + '</span></span>'
          + '<span class="badges">' + badges + '</span>'
          + '</label>';
      }

      function renderList() {
        if (!state.ready) return;
        var visible = visibleStocks();
        loading.hidden = true;
        empty.hidden = visible.length !== 0;
        list.hidden = visible.length === 0;
        list.innerHTML = visible.map(stockRow).join("");
        resultCount.textContent = visible.length + " 只结果";
      }

      function feedUrls() {
        var symbols = Array.from(state.selected).sort();
        var selection = symbols.length ? encodeURIComponent(symbols.join(",")) : "NONE";
        var https = location.origin + "/calendar.ics?stocks=" + selection;
        return { https: https, webcal: https.replace(/^https?:/, "webcal:") };
      }

      function renderSubscription() {
        var symbols = Array.from(state.selected).sort();
        var urls = feedUrls();
        selectedCount.textContent = String(symbols.length);
        earningsCount.textContent = symbols.length + " 家";
        selectionDescription.textContent = symbols.length
          ? "将显示这些公司的财报事件"
          : "当前将仅订阅经济数据";
        if (symbols.length) {
          var shown = symbols.slice(0, 8).map(function (symbol) {
            return '<span class="selection-chip">' + escapeHtml(symbol) + '</span>';
          });
          if (symbols.length > 8) shown.push('<span class="selection-chip">+' + (symbols.length - 8) + '</span>');
          selectionPreview.innerHTML = shown.join("");
        } else {
          selectionPreview.innerHTML = '<span class="selection-empty">尚未选择公司</span>';
        }
        subscriptionUrl.value = urls.https;
        subscribeButton.href = urls.webcal;
      }

      function render() {
        renderList();
        renderSubscription();
      }

      function setSelection(symbol, checked) {
        if (checked) state.selected.add(symbol);
        else state.selected.delete(symbol);
        saveSelection();
        render();
      }

      function showToast(message) {
        clearTimeout(toastTimer);
        toast.textContent = message;
        toast.classList.add("show");
        toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 1800);
      }

      async function copyUrl() {
        var value = feedUrls().https;
        try {
          await navigator.clipboard.writeText(value);
        } catch (_) {
          subscriptionUrl.focus();
          subscriptionUrl.select();
          document.execCommand("copy");
        }
        showToast("订阅地址已复制");
      }

      list.addEventListener("change", function (event) {
        var input = event.target;
        if (!(input instanceof HTMLInputElement) || input.type !== "checkbox") return;
        setSelection(input.value, input.checked);
      });

      search.addEventListener("input", function () {
        state.query = search.value;
        renderList();
      });

      document.querySelectorAll(".tab").forEach(function (tab) {
        tab.addEventListener("click", function () {
          state.filter = tab.getAttribute("data-filter") || "all";
          document.querySelectorAll(".tab").forEach(function (item) {
            item.setAttribute("aria-selected", String(item === tab));
          });
          renderList();
        });
      });

      document.getElementById("selectVisible").addEventListener("click", function () {
        visibleStocks().forEach(function (stock) { state.selected.add(stock.symbol); });
        saveSelection();
        render();
        showToast("已选择当前筛选结果");
      });

      document.getElementById("clearSelected").addEventListener("click", function () {
        state.selected.clear();
        saveSelection();
        render();
        showToast("已清空股票选择");
      });

      document.getElementById("copyButton").addEventListener("click", copyUrl);
      document.getElementById("copyIcon").addEventListener("click", copyUrl);
      document.addEventListener("keydown", function (event) {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          search.focus();
        }
      });

      async function loadCatalog() {
        state.selected = readSelection();
        renderSubscription();
        try {
          var response = await fetch("/api/stocks", { headers: { "accept": "application/json" } });
          if (!response.ok) throw new Error("HTTP " + response.status);
          var data = await response.json();
          state.stocks = Array.isArray(data.stocks) ? data.stocks : [];
          var known = new Set(state.stocks.map(function (stock) { return stock.symbol; }));
          state.selected = new Set(Array.from(state.selected).filter(function (symbol) { return known.has(symbol); }));
          state.ready = true;
          saveSelection();
          document.getElementById("heroTotal").textContent = String(data.counts && data.counts.unique || state.stocks.length);
          var timestamp = data.updatedAt ? new Date(data.updatedAt) : null;
          var updateText = timestamp && !isNaN(timestamp.getTime())
            ? new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(timestamp)
            : "最近快照";
          document.getElementById("syncText").textContent = data.source === "kv"
            ? "全量 KV 已同步 · " + updateText
            : "内置目录可用 · 等待 KV 同步";
          render();
        } catch (error) {
          state.ready = true;
          loading.hidden = true;
          empty.hidden = false;
          empty.innerHTML = "<div><strong>股票目录暂时不可用</strong><br><span class=\\"subtle\\">请稍后刷新页面重试</span></div>";
          resultCount.textContent = "载入失败";
          document.getElementById("syncText").textContent = "目录暂时不可用";
        }
      }

      loadCatalog();
    })();
  </script>
</body>
</html>`;
}
