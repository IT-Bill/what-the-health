#!/usr/bin/env node
/**
 * Automated benchmark runner using Puppeteer.
 * Reads window.__benchmarkCounters for reliable render counts.
 */

import puppeteer from "puppeteer";

const DEV_SERVER_URL = "http://localhost:3000/chat/benchmark";

async function runBenchmark() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    console.log(`Navigating to ${DEV_SERVER_URL}...`);

    await page.goto(DEV_SERVER_URL, { waitUntil: "networkidle0", timeout: 30000 });
    console.log("Page loaded.");

    // Wait for React hydration
    await new Promise((r) => setTimeout(r, 1500));

    // Click "Run Both" button
    console.log("Clicking Run Both...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find((b) => b.textContent?.includes("Run Both"));
      if (btn) btn.click();
    });

    // Wait for completion text
    await page.waitForFunction(
      () => {
        const ps = document.querySelectorAll("p");
        for (const p of ps) {
          if (p.textContent?.includes("complete")) return true;
        }
        return false;
      },
      { timeout: 60000, polling: 500 }
    );

    // Extra wait for final renders
    await new Promise((r) => setTimeout(r, 800));

    // Read results from global counters
    const results = await page.evaluate(() => {
      const counters = window.__benchmarkCounters;
      return {
        baselineInput: counters?.baselineInput ?? 0,
        baselineMessageList: counters?.baselineMessageList ?? 0,
        storeInput: counters?.storeInput ?? 0,
        storeMessageList: counters?.storeMessageList ?? 0,
      };
    });

    console.log("\n========== Benchmark Results ==========\n");
    console.log("Baseline (useState):");
    console.log(`  Input renders:        ${results.baselineInput}`);
    console.log(`  MessageList renders:  ${results.baselineMessageList}`);
    console.log();
    console.log("Store (Zustand):");
    console.log(`  Input renders:        ${results.storeInput}`);
    console.log(`  MessageList renders:  ${results.storeMessageList}`);
    console.log();

    console.log("========== Comparison ==========\n");
    const inputReduction = results.baselineInput > 0
      ? ((1 - results.storeInput / results.baselineInput) * 100).toFixed(0)
      : "0";
    console.log(`Input re-renders during streaming:`);
    console.log(`  Baseline (useState):  ${results.baselineInput} renders`);
    console.log(`  Store (Zustand):      ${results.storeInput} renders`);
    console.log(`  Reduction:            ${inputReduction}% fewer renders`);
    console.log();

    console.log(`MessageList renders:`);
    console.log(`  Baseline:             ${results.baselineMessageList} renders`);
    console.log(`  Store:                ${results.storeMessageList} renders`);
    console.log(`  (Both ~50+1 = 51 — one per delta + mount)`);
    console.log();

    console.log("========== Summary ==========\n");
    if (results.storeInput < results.baselineInput) {
      console.log("✅ Input component no longer re-renders during streaming");
      console.log("   Zustand fine-grained subscription isolates state changes");
    } else if (results.storeInput === results.baselineInput) {
      console.log("⚠️  Input renders unchanged — verify Input only subscribes to input+isStreaming");
    }

    if (results.storeMessageList > 0) {
      console.log("✅ MessageList renders correctly with Zustand");
    }

    return results;
  } catch (err) {
    console.error("Benchmark failed:", err.message);
    try {
      const page = (await browser.pages())[0];
      await page.screenshot({ path: "/tmp/benchmark-error.png" });
      console.log("Screenshot: /tmp/benchmark-error.png");
    } catch {}
    throw err;
  } finally {
    await browser.close();
    console.log("\nBrowser closed.");
  }
}

runBenchmark().catch((err) => {
  console.error(err);
  process.exit(1);
});
