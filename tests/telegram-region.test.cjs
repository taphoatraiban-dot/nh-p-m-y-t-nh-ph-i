// Run: node tests/telegram-region.test.cjs
// Reads the classifier from the production HTML to prevent test/code drift.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const html = fs.readFileSync("index.html", "utf8");
const begin = html.indexOf("const regionOf=m=>");
const end = html.indexOf("let expandedMessages", begin);
assert.ok(begin >= 0 && end > begin, "Telegram classifier not found");
const classify = new Function(html.slice(begin, end) + ";return regionOf;")();
const cases = [
  ["blieu", "2026-10-22T09:00:00Z", "MN"],
  ["bthuan", "2026-10-22T09:00:00Z", "MN"],
  ["Bến Tre b10", "2026-10-22T09:00:00Z", "MN"],
  ["Đắk Lắk b10", "2026-10-22T09:00:00Z", "MT"],
  ["Đà Nẵng b10", "2026-10-22T09:00:00Z", "MT"],
  ["hn", "2026-10-22T09:00:00Z", "MB"],
  ["2dmt 1120da10", "2026-10-22T09:00:00Z", "MT"],
  ["2dmn 1120da10", "2026-10-22T09:00:00Z", "MN"],
  ["btre dlak", "2026-10-22T09:00:00Z", "OTHER"],
  ["123b10", "2026-10-22T09:00:00Z", "MN"],
  ["123b10", "2026-10-22T09:30:00Z", "MT"],
  ["123b10", "2026-10-22T11:00:00Z", "MB"]
];
for (const [message_text, received_at, expected] of cases) {
  assert.equal(classify({message_text, received_at}), expected, message_text);
}
assert.equal(classify({message_text:"", received_at:"invalid"}), "OTHER");
assert.equal(classify({message_text:"", received_at:"2026-10-22T11:00:00Z", message_date:"2026-10-22T08:00:00Z"}), "MB", "receipt time must override forwarded original time");
console.log("Telegram region regression: " + (cases.length + 2) + " tests passed.");
