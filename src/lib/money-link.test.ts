import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dayCostItems, dayIdForDate, moneyEstimateUrl, moneyLinkBackUrl, moneySpendUrl, parsePrice, rideSpendLabel, tripCosts, tripCurrency, tripEstimate, rankTripBooks, readMoneyRef, spendItem, spendItemKey, spendOnDay, spendTimeHint } from "./money-link.ts";
import type { TripBook } from "./trip.ts";

function book(patch: Partial<TripBook> & Pick<TripBook, "id" | "title">): TripBook {
  return {
    schemaVersion: 1,
    locale: "zh-HK",
    subtitle: "",
    tagline: "",
    nav: [],
    overviewHtml: "",
    rationales: [],
    days: [],
    transport: { introHtml: "", blocks: [] },
    guides: [],
    footer: "",
    ...patch,
  };
}

describe("money link", () => {
  const osaka = book({
    id: "osaka-book",
    title: "大阪散步",
    subtitle: "2026",
    days: [
      { id: "d1", city: "osaka", label: "4月2日", title: "抵達", leadHtml: "", walkHtml: "", foodHtml: "", noteHtml: "", sun: { sunrise: "", sunset: "", sunriseCity: "", sunsetCity: "" }, meals: [], hotels: [], rides: [{ from: "關西", to: "難波", mode: "電車", detail: "南海", price: "¥930", note: "", spot: "", entry: "" }], images: [], spots: [{ id: "d1-sight-1", name: "通天閣", badge: "", tone: "", hours: "", address: "", price: "¥800", image: "", refLink: "", refLabel: "", html: "" }], timeline: [] },
      { id: "d2", city: "osaka", label: "4月8日", title: "回程", leadHtml: "", walkHtml: "", foodHtml: "", noteHtml: "", sun: { sunrise: "", sunset: "", sunriseCity: "", sunsetCity: "" }, meals: [], hotels: [], rides: [], images: [], spots: [], timeline: [] },
    ],
  });

  it("reads the money trip from the query", () => {
    const ref = readMoneyRef("?money=osaka&name=大阪&dest=大阪&start=2026-04-02&end=2026-04-08&pick=1&day=2026-04-02");
    assert.equal(ref?.id, "osaka");
    assert.equal(ref?.pick, true);
    assert.equal(ref?.day, "2026-04-02");
    assert.equal(dayIdForDate(osaka, "2026-04-02"), "d1");
    assert.equal(dayIdForDate(osaka, "2026-04-03"), "");
    assert.match(moneyLinkBackUrl(ref!, "osaka-book", "大阪散步"), /^https:\/\/girigurubilly\.github\.io\/MoneyTracker\/#link=/);
  });

  it("picks the book whose dates overlap that trip", () => {
    const other = book({ id: "madrid", title: "馬德里", subtitle: "2025", days: [{ ...osaka.days[0], id: "m", label: "5月2日", city: "madrid" }] });
    const ranked = rankTripBooks([other, osaka], { id: "osaka", name: "大阪", dest: "大阪", start: "2026-04-02", end: "2026-04-08", book: "", pick: false, day: "2026-04-02" }, {});
    assert.equal(ranked.best?.id, "osaka-book");
  });

  it("sends that day's priced rows to the money app", () => {
    assert.equal(parsePrice("免費"), null);
    assert.deepEqual(parsePrice("€2.20"), { amount: 2.2, currency: "EUR" });
    const items = spendOnDay(osaka, osaka.days[0]);
    assert.equal(items.length, 2);
    assert.equal(spendItem(osaka, osaka.days[0], "通天閣", "¥800")?.amount, 800);
    assert.equal(spendItem(osaka, osaka.days[0], "通天閣", "免費"), null);
    assert.equal(spendItem(osaka, osaka.days[0], "通天閣", "免費", true)?.amount, 0);
    assert.equal(spendItem(osaka, osaka.days[0], "通天閣", "¥800", false, "sight", "", "d1-sight-1")?.key, "osaka-book:d1:d1-sight-1");
    assert.equal(spendItem(osaka, osaka.days[0], "南海 特急", "¥930", false, "ride")?.key, "osaka-book:d1:ride:南海-特急");
    assert.equal(spendItemKey("b", "d", "meal", "", "a:b"), "b:d:meal:a-b");
    assert.equal(spendItem(osaka, osaka.days[0], "通天閣", "", true)?.currency, "JPY");
    assert.equal(items[0]?.date, "2026-04-02");
    assert.equal(items.find((item) => item.label === "通天閣")?.category, "sight");
    assert.equal(items.find((item) => item.category === "ride")?.category, "ride");
    assert.ok(items.some((item) => item.category === "ride" && (item.label.includes("南海") || item.label.includes("難波") || item.label.includes("關西"))));
    assert.equal(spendItem(osaka, osaka.days[0], "通天閣", "¥800", false, "sight")?.category, "sight");
    assert.equal(spendItem(osaka, osaka.days[0], "晚餐", "¥1200", false, "meal")?.category, "meal");
    const url = new URL(moneySpendUrl({ trip: "大阪散步", tripId: "osaka", items }));
    assert.match(url.hash, /^#proposal=/);
    assert.equal(url.origin + url.pathname, "https://girigurubilly.github.io/MoneyTracker/");
    assert.equal(spendTimeHint("晚餐", "11:00-18:00"), "11:00");
    assert.equal(spendTimeHint("晚餐", ""), "19:00");
    assert.equal(spendItem(osaka, osaka.days[0], "晚餐", "¥1200", false, "meal", "19:00")?.time, "19:00");
  });

  it("reads every supported currency and uses the trip's own currency when unmarked", () => {
    assert.deepEqual(parsePrice("800円"), { amount: 800, currency: "JPY" });
    assert.deepEqual(parsePrice("1,200 日圓"), { amount: 1200, currency: "JPY" });
    assert.deepEqual(parsePrice("¥800"), { amount: 800, currency: "JPY", guess: true });
    assert.deepEqual(parsePrice("¥800", "JPY"), { amount: 800, currency: "JPY" });
    assert.deepEqual(parsePrice("¥60", "CNY"), { amount: 60, currency: "CNY" });
    assert.deepEqual(parsePrice("人民幣 60"), { amount: 60, currency: "CNY" });
    assert.deepEqual(parsePrice("₩15,000"), { amount: 15000, currency: "KRW" });
    assert.deepEqual(parsePrice("12000원"), { amount: 12000, currency: "KRW" });
    assert.deepEqual(parsePrice("฿350"), { amount: 350, currency: "THB" });
    assert.deepEqual(parsePrice("S$12"), { amount: 12, currency: "SGD" });
    assert.deepEqual(parsePrice("US$12"), { amount: 12, currency: "USD" });
    assert.deepEqual(parsePrice("A$30"), { amount: 30, currency: "AUD" });
    assert.deepEqual(parsePrice("MOP 80"), { amount: 80, currency: "MOP" });
    assert.deepEqual(parsePrice("澳門幣 80"), { amount: 80, currency: "MOP" });
    assert.deepEqual(parsePrice("CHF 25"), { amount: 25, currency: "CHF" });
    assert.deepEqual(parsePrice("NT$250"), { amount: 250, currency: "TWD" });
    assert.deepEqual(parsePrice("HK$40"), { amount: 40, currency: "HKD" });
    assert.deepEqual(parsePrice("€2.20"), { amount: 2.2, currency: "EUR" });
    assert.deepEqual(parsePrice("$5", "SGD"), { amount: 5, currency: "SGD" });
    assert.deepEqual(parsePrice("$5", "EUR"), { amount: 5, currency: "USD", guess: true });
    assert.deepEqual(parsePrice("約 1500", "JPY"), { amount: 1500, currency: "JPY", guess: true });
    assert.deepEqual(parsePrice("1500"), { amount: 1500, currency: "HKD", guess: true });
    assert.equal(parsePrice("Free entry"), null);
    assert.equal(parsePrice("0"), null);
  });

  it("guesses the trip currency from its cities", () => {
    assert.equal(tripCurrency(osaka), "JPY");
    const seoul = book({ id: "s", title: "首爾", days: [{ ...osaka.days[0], city: "seoul" }] });
    assert.equal(tripCurrency(seoul), "KRW");
    const shanghai = book({ id: "c", title: "上海", days: [{ ...osaka.days[0], city: "上海", rides: [], spots: [{ ...osaka.days[0].spots[0], price: "¥60" }] }] });
    assert.equal(tripCurrency(shanghai), "CNY");
    assert.equal(dayCostItems(shanghai, shanghai.days[0])[0]?.currency, "CNY");
    assert.equal(dayCostItems(shanghai, shanghai.days[0])[0]?.currencyGuess, undefined);
    const unknown = book({ id: "u", title: "x", days: [{ ...osaka.days[0], city: "somewhere", rides: [], spots: [{ ...osaka.days[0].spots[0], price: "€5" }] }] });
    assert.equal(tripCurrency(unknown), "EUR");
  });

  it("labels rides by route, not by duration", () => {
    assert.equal(rideSpendLabel({ from: "關西", to: "難波", mode: "電車", detail: "約 50 分鐘" }), "關西 → 難波 · 電車");
    assert.equal(rideSpendLabel({ from: "", to: "", mode: "", detail: "南海特急" }), "南海特急");
    assert.equal(rideSpendLabel({ from: "", to: "", mode: "", detail: "約 50 分鐘" }), "交通");
  });

  it("batches a day with stable keys and sums the trip", () => {
    const day = { ...osaka.days[0], hotels: [{ id: "h1", name: "難波酒店", hours: "", price: "¥12000", address: "", html: "", image: "", refLink: "", refLabel: "" }] } as unknown as TripBook["days"][number];
    const trip = book({ ...osaka, days: [day, { ...osaka.days[1], hotels: day.hotels }] });
    const items = dayCostItems(trip, trip.days[0]);
    assert.deepEqual(items.map((item) => item.key), ["osaka-book:d1:d1-sight-1", "osaka-book:d1:h1", "osaka-book:d1:ride-關西-難波"]);
    assert.equal(items[2]?.label, "關西 → 難波 · 電車");
    assert.equal(dayCostItems(trip, trip.days[1]).length, 0, "checkout-day hotel is not charged twice");
    const costs = tripCosts(trip);
    assert.equal(costs.totals.JPY?.all, 800 + 930 + 12000);
    assert.equal(costs.totals.JPY?.hotel, 12000);
    const estimate = tripEstimate(trip, costs);
    assert.equal(estimate.start, "2026-04-02");
    assert.equal(estimate.end, "2026-04-08");
    assert.equal(estimate.count, 3);
    const url = new URL(moneyEstimateUrl(estimate));
    assert.match(url.hash, /^#estimate=/);
  });
});
