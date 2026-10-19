import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dayIdForDate, moneyLinkBackUrl, moneySpendUrl, parsePrice, rankTripBooks, readMoneyRef, spendItem, spendOnDay } from "./money-link.ts";
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
    assert.equal(items[0]?.date, "2026-04-02");
    const url = new URL(moneySpendUrl({ trip: "大阪散步", tripId: "osaka", items }));
    assert.match(url.hash, /^#proposal=/);
    assert.equal(url.origin + url.pathname, "https://girigurubilly.github.io/MoneyTracker/");
  });
});
