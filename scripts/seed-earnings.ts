import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fetchIndexDataset } from "../src/constituents";
import { EARNINGS_KV_KEYS, fetchEarningsRange, isCompleteEarningsRange } from "../src/earnings";
import { rebuildSnapshot, type Env } from "../src/index";

interface MemoryEntry {
  value: string;
  metadata?: unknown;
}

class MemoryKv {
  readonly entries = new Map<string, MemoryEntry>();

  async get<T = string>(key: string, type?: "text" | "json"): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    return (type === "json" ? JSON.parse(entry.value) : entry.value) as T;
  }

  async put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: KVNamespacePutOptions): Promise<void> {
    if (typeof value !== "string") throw new Error(`Seed only supports string KV values (${key})`);
    this.entries.set(key, { value, metadata: options?.metadata });
  }
}

async function main(): Promise<void> {
  const local = process.argv.includes("--local");
  const dryRun = process.argv.includes("--dry-run");
  if (local && process.argv.includes("--remote")) throw new Error("Choose either --local or --remote");

  const now = new Date();
  const memory = new MemoryKv();
  const kv = memory as unknown as KVNamespace;
  const env: Env = {
    EARNINGS_DATA: kv,
    ...(process.env.FMP_API_KEY ? { FMP_API_KEY: process.env.FMP_API_KEY } : {}),
  };

  console.log(`[seed] fetching index constituents at ${now.toISOString()}`);
  const indices = await fetchIndexDataset(now);
  await memory.put(EARNINGS_KV_KEYS.indices, JSON.stringify(indices));
  console.log(`[seed] constituents: S&P 500=${indices.sp500.length} (${indices.states.sp500}), Nasdaq-100=${indices.nasdaq100.length} (${indices.states.nasdaq100})`);

  console.log("[seed] fetching Nasdaq earnings for the previous 30 days through today");
  const past = await fetchEarningsRange("past", now);
  await memory.put(EARNINGS_KV_KEYS.past, JSON.stringify(past));
  console.log(`[seed] past window: ${Object.keys(past.days).length} dates, ${past.failedDates.length} failure(s)`);

  console.log("[seed] fetching Nasdaq earnings for the next 30 days");
  const future = await fetchEarningsRange("future", now);
  await memory.put(EARNINGS_KV_KEYS.future, JSON.stringify(future));
  console.log(`[seed] future window: ${Object.keys(future.days).length} dates, ${future.failedDates.length} failure(s)`);

  const pastDays = Object.keys(past.days).length;
  const futureDays = Object.keys(future.days).length;
  const complete = isCompleteEarningsRange(past) && isCompleteEarningsRange(future);
  if (!complete && !dryRun) {
    throw new Error(
      `Refusing to publish an incomplete earnings window `
      + `(past ${pastDays}/31 with ${past.failedDates.length} failure(s); `
      + `future ${futureDays}/30 with ${future.failedDates.length} failure(s)).`,
    );
  }

  console.log("[seed] building combined economic and earnings calendar snapshot");
  const health = await rebuildSnapshot(env, now);
  const bulk = [...memory.entries].map(([key, entry]) => ({ key, value: entry.value, ...(entry.metadata ? { metadata: entry.metadata } : {}) }));

  console.log(`[seed] prepared ${health.events} events; sources healthy=${health.ok}; FMP values=${health.values.state} (${health.values.metrics} metrics)`);
  if (dryRun) {
    console.log(`[seed] dry run complete (${bulk.length} KV keys, no data uploaded)`);
    return;
  }

  const temporaryDirectory = await mkdtemp(join(tmpdir(), "us-calendar-seed-"));
  const bulkFile = join(temporaryDirectory, "earnings-kv.json");
  try {
    await writeFile(bulkFile, JSON.stringify(bulk), "utf8");
    const mode = local ? "--local" : "--remote";
    const result = spawnSync(
      "npx",
      ["--no-install", "wrangler", "kv", "bulk", "put", bulkFile, "--binding", "EARNINGS_DATA", mode],
      { cwd: process.cwd(), stdio: "inherit" },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`wrangler kv bulk put exited with status ${result.status}`);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
  console.log(`[seed] ${local ? "local" : "remote"} EARNINGS_DATA initialized`);
}

await main();
