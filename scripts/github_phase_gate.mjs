const mode = process.argv[2] || "";
const slot = process.argv[3] || "afternoon";

function kstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

const today = formatDate(kstNow());
const phase2Start = "2026-05-28";
const secondPostSlots = new Set(["evening", "night"]);
const run = !(secondPostSlots.has(slot) && today < phase2Start);

console.log(`mode=${mode}`);
console.log(`slot=${slot}`);
console.log(`kst_date=${today}`);
console.log(`run=${run ? "true" : "false"}`);
