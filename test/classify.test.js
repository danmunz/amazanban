// Status strings below are real ones seen on amazon.com "Your Orders" pages.
const test = require("node:test");
const assert = require("node:assert/strict");

require("../extension/src/classify.js");
const { classify } = globalThis.Amazanban;

// Friday, October 16, 2026
const today = new Date(2026, 9, 16);
const lane = (primary, secondary = "") => classify(primary, secondary, { today });

test("arriving today and tomorrow", () => {
  assert.equal(lane("Arriving today").key, "today");
  assert.equal(lane("Arriving today 5 PM – 10 PM").key, "today");
  assert.equal(lane("Out for delivery").key, "today");
  assert.equal(lane("Arriving tomorrow").key, "tomorrow");
});

test("arriving on a later date gets its own column", () => {
  const range = lane("Arriving October 22 - October 26");
  assert.equal(range.key, "arriving-2026-10-22");
  assert.match(range.label, /Oct 22/);

  assert.equal(lane("Arriving Monday").key, "arriving-2026-10-19");
});

test("further-out dates sort further left", () => {
  const soon = lane("Arriving October 19");
  const later = lane("Arriving October 28");
  const tomorrow = lane("Arriving tomorrow");
  assert.ok(later.order < soon.order);
  assert.ok(soon.order < tomorrow.order);
});

test("dates in January resolve to next year", () => {
  assert.equal(lane("Arriving January 4").key, "arriving-2027-01-04");
});

test("delivered buckets", () => {
  assert.equal(lane("Delivered today").key, "deliveredToday");
  assert.equal(lane("Delivered October 16").key, "deliveredToday");
  assert.equal(lane("Delivered October 15").key, "deliveredYesterday");
  assert.equal(lane("Delivered yesterday").key, "deliveredYesterday");
  assert.equal(lane("Delivered October 12").key, "deliveredWeek");
  assert.equal(lane("Delivered September 3").key, "deliveredEarlier");
});

test("returns and refunds", () => {
  assert.equal(lane("Return started", "Your refund will be processed when we receive your item.").key, "returning");
  assert.equal(lane("Replacement ordered").key, "returning");
  assert.equal(lane("Return complete").key, "returned");
  assert.equal(lane("Refunded", "Your return is in transit. Your refund has been issued.").key, "returned");
  assert.equal(lane("Refund issued").key, "returned");
});

test("late or problem shipments", () => {
  assert.equal(lane("Arriving October 10").key, "late");
  assert.equal(lane("Delivery attempted").key, "late");
  assert.equal(lane("Now arriving October 19", "Running late").key, "late");
});

test("everything else", () => {
  assert.equal(lane("Cancelled").key, "cancelled");
  assert.equal(lane("Preparing for Shipment").key, "preparing");
  assert.equal(lane("Shipped").key, "transit");
  assert.equal(lane("Purchased at Whole Foods Market").key, "instore");
  assert.equal(lane("").key, "other");
  assert.equal(lane("Something Amazon invents next year").key, "other");
});
