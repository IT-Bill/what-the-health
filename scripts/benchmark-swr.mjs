/**
 * SWR Performance Benchmark
 * 
 * Run in browser console on the deployed site:
 * 1. Open DevTools → Network tab
 * 2. Clear network log
 * 3. Navigate between pages (Discover → Profile → Discover)
 * 4. Compare request counts
 * 
 * Or run this script to analyze the code reduction:
 */

import { readFileSync } from "fs";
import { globSync } from "glob";

const files = globSync("src/**/*.{ts,tsx}");

let fetchCount = 0;
let swrImportCount = 0;
let useUserCount = 0;

for (const file of files) {
  const content = readFileSync(file, "utf-8");
  const fetches = (content.match(/fetch\("/g) || []).length;
  fetchCount += fetches;
  
  if (content.includes('from "@/lib/swr"') || content.includes("from '@/lib/swr'")) {
    swrImportCount++;
  }
  if (content.includes("useUser(")) {
    useUserCount++;
  }
}

console.log("=== SWR Adoption Report ===\n");
console.log(`Files importing from @/lib/swr: ${swrImportCount}`);
console.log(`Components using useUser(): ${useUserCount}`);
console.log(`Remaining fetch() calls: ${fetchCount}`);
console.log("\n=== Expected Runtime Benefits ===");
console.log("Before: Each page navigation triggered independent /api/me requests");
console.log("After:  /api/me is deduplicated across all components via SWR cache");
console.log("\nBefore: Session list refreshed via manual fetch after every message");
console.log("After:  Session list auto-revalidated via mutate() + SWR dedup");
