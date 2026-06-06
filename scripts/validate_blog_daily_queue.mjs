import fs from "node:fs";
import { validateDailyQueue } from "./blog_marketing_policy.mjs";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node scripts/validate_blog_daily_queue.mjs QUEUE_JSON");
  process.exit(1);
}

const queue = JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
const errors = validateDailyQueue(queue);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, posts: queue.posts.length }, null, 2));
