import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cityLabel, dayChipParts, dayDates, nextStop, parseTripBook, sortTrips, tripStart, type TripBook } from "./trip.ts";
import { t } from "./i18n.ts";

function book(extra: Record<string, unknown> = {}, days: Array<Record<string, unknown>> = []): TripBook {
  return parseTripBook({
    schemaVersion: 1,
    id: "x-" + Math.random().toString(36).slice(2, 8),
    title: "測試",
    days: days.length
      ? days
      : [
          { id: "d1", city: "porto", label: "Day 1", title: "a", spots: [{ name: "A" }, { name: "B" }] },
          { id: "d2", city: "porto", label: "Day 2", title: "b", spots: [{ name: "C" }] },
        ],
    ...extra,
  });
}

describe("startDate and city names (item 9)", () => {
  it("keeps a valid startDate and drops a bad one", () => {
    assert.equal(book({ startDate: "2027-04-02" }).startDate, "2027-04-02");
    assert.equal(book({ startDate: "2027-13-40" }).startDate, undefined);
    assert.equal(book({ startDate: "next week" }).startDate, undefined);
  });

  it("drives day dates even when labels carry no date", () => {
    const dates = dayDates(book({ startDate: "2027-04-02" }));
    assert.deepEqual(
      dates.map((d) => d && `${d.getMonth() + 1}/${d.getDate()}`),
      ["4/2", "4/3"],
    );
    assert.equal(tripStart({ startDate: "2027-04-02" })?.getDate(), 2);
  });

  it("crosses the year with startDate", () => {
    const trip = book({ startDate: "2026-12-31" }, [
      { id: "d1", city: "tokyo", label: "12/31", title: "a" },
      { id: "d2", city: "tokyo", label: "1/1", title: "b" },
    ]);
    const [a, b] = dayDates(trip);
    assert.equal(a?.getFullYear(), 2026);
    assert.equal(b?.getFullYear(), 2027);
    assert.equal(b?.getMonth(), 0);
  });

  it("falls back to label guessing without startDate", () => {
    const trip = book({ subtitle: "2027年4月" }, [{ id: "d1", city: "osaka", label: "4/2（五）", title: "a" }]);
    assert.equal(dayDates(trip)[0]?.getDate(), 2);
  });

  it("uses per-trip city names before the built-in table", () => {
    const trip = book({ cityNames: { Porto: "波爾圖" } }, [
      { id: "d1", city: "porto", label: "4/2", title: "a" },
      { id: "d2", city: "gaia", cityName: "加亞新城", label: "4/3", title: "b" },
    ]);
    assert.equal(cityLabel("porto", trip.cityNames), "波爾圖");
    assert.equal(cityLabel("gaia", trip.cityNames), "加亞新城");
    assert.equal(cityLabel("osaka", trip.cityNames), "大阪");
    assert.equal(cityLabel("nowhere", trip.cityNames), "nowhere");
  });

  it("uses a short label note as the chip hint, not a hardcoded holiday", () => {
    assert.equal(dayChipParts({ label: "12/25 聖誕", city: "osaka" }).hint, "聖誕");
    assert.equal(dayChipParts({ label: "4/2 生日", city: "osaka" }).hint, "生日");
    assert.equal(dayChipParts({ label: "4/2（五）", city: "osaka" }).hint, "週五");
    assert.equal(dayChipParts({ label: "4/9", city: "porto" }, { porto: "波爾圖" }).hint, "波爾圖");
  });
});

describe("next stop (item 8)", () => {
  it("returns the first unchecked stop in plan order", () => {
    const trip = book();
    const day = trip.days[0]!;
    const first = nextStop(day, {});
    assert.equal(first.total, 2);
    assert.equal(first.next?.entry.kind, "spot");
    assert.equal(first.next?.entry.index, 0);
    const second = nextStop(day, { [first.next!.key]: "10:00" });
    assert.equal(second.next?.entry.index, 1);
    assert.equal(second.done, 1);
    const all = nextStop(day, { [first.next!.key]: "10:00", [second.next!.key]: "11:00" });
    assert.equal(all.next, null);
    assert.equal(all.done, 2);
  });
});

describe("library order (item 10)", () => {
  it("puts ongoing first, then upcoming by countdown, undated, then finished", () => {
    const now = new Date(2027, 3, 10, 12);
    const ongoing = book({ id: "on", startDate: "2027-04-09" });
    const soon = book({ id: "soon", startDate: "2027-04-20" });
    const later = book({ id: "later", startDate: "2027-06-01" });
    const done = book({ id: "done", startDate: "2027-01-01" });
    const undated = book({ id: "nodate" });
    const ids = sortTrips([done, later, undated, soon, ongoing], now).map((trip) => trip.id);
    assert.deepEqual(ids, ["on", "soon", "later", "nodate", "done"]);
  });
});

describe("i18n", () => {
  it("interpolates zh-HK strings", () => {
    assert.equal(t("next.progress", { done: 1, total: 3 }), "已打卡 1/3");
    assert.equal(t("tab.eat"), "美食手信");
    assert.equal(t("tab.more"), "更多");
  });
});
