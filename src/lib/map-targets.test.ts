import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapEntryTargets, planItems } from "./trip.ts";
import type { TripDay, TripHotel, TripMeal, TripSpot } from "./trip.ts";

function spot(patch: Partial<TripSpot> & Pick<TripSpot, "id" | "name">): TripSpot {
  return { badge: "", tone: "", hours: "", address: "", price: "", image: "", refLink: "", refLabel: "", html: "", ...patch };
}

function meal(patch: Partial<TripMeal> & Pick<TripMeal, "id" | "place">): TripMeal {
  return {
    slot: "",
    name: patch.place,
    badge: "",
    tone: "",
    hours: "",
    address: "",
    price: "",
    image: "",
    refLink: "",
    refLabel: "",
    html: "",
    note: "",
    ...patch,
  };
}

function hotel(patch: Partial<TripHotel> & Pick<TripHotel, "id" | "name">): TripHotel {
  return spot(patch);
}

function day(patch: Partial<TripDay> & Pick<TripDay, "id" | "city">): TripDay {
  return {
    label: "",
    title: "",
    leadHtml: "",
    walkHtml: "",
    foodHtml: "",
    noteHtml: "",
    sun: { sunrise: "", sunset: "", sunriseCity: "", sunsetCity: "" },
    meals: [],
    hotels: [],
    rides: [],
    images: [],
    spots: [],
    timeline: [],
    ...patch,
  };
}

describe("mapEntryTargets", () => {
  it("mirrors the unified timeline: sights + meals + hotels, in order, with timeline numbers", () => {
    const input = day({
      id: "dec19",
      city: "milan",
      spots: [
        spot({ id: "dec19-sight-1", name: "Pinacoteca di Brera", address: "Via Brera 28, Milano" }),
        spot({ id: "dec19-sight-2", name: "Duomo", address: "Piazza del Duomo, Milano" }),
      ],
      meals: [
        meal({ id: "dec19-meal-1", place: "Cafezal", address: "Via Solferino 27, Milano" }),
        meal({ id: "dec19-meal-2", place: "晚餐（輕食，11月底再核實）" }),
      ],
      hotels: [hotel({ id: "dec19-hotel-1", name: "Hotel Cavour", address: "Via Fatebenefratelli 21, Milano" })],
      timeline: ["dec19-sight-1", "dec19-meal-1", "dec19-sight-2", "dec19-meal-2", "dec19-hotel-1"],
    });
    const targets = mapEntryTargets(input);
    assert.deepEqual(
      targets.map((t) => [t.num, t.kind, t.name]),
      [
        [1, "spot", "Pinacoteca di Brera"],
        [2, "meal", "Cafezal"],
        [3, "spot", "Duomo"],
        [4, "meal", "晚餐（輕食，11月底再核實）"],
        [5, "hotel", "Hotel Cavour"],
      ],
    );
    assert.equal(targets[0].query, "Via Brera 28, Milano, Milano, Italy");
    assert.equal(targets[1].query, "Via Solferino 27, Milano, Milano, Italy");
    // Undecided dinner has no locatable place: listed, but with no query (no invented pin).
    assert.equal(targets[3].query, null);
    assert.equal(targets[4].query, "Via Fatebenefratelli 21, Milano, Milano, Italy");
  });

  it("transfer days: entries geocode against their own city, not the day's start city", () => {
    const input = day({
      id: "dec21",
      city: "milan",
      spots: [spot({ id: "dec21-sight-1", name: "Santa Croce", address: "Piazza di Santa Croce, 50122 Firenze" })],
      meals: [meal({ id: "dec21-meal-1", place: "Ditta Artigianale", address: "Via dei Neri 32r" })],
      hotels: [hotel({ id: "dec21-hotel-1", name: "Grand Hotel Baglioni", address: "Piazza dell'Unità Italiana 6, Firenze" })],
      timeline: ["dec21-sight-1", "dec21-meal-1", "dec21-hotel-1"],
    });
    const targets = mapEntryTargets(input);
    // Santa Croce + Baglioni name Firenze in their addresses → Florence query + bias.
    assert.equal(targets[0].query, "Piazza di Santa Croce, 50122 Firenze, Firenze, Italy");
    assert.deepEqual(targets[0].bias, { lat: 43.7696, lng: 11.2558 });
    assert.equal(targets[2].query, "Piazza dell'Unità Italiana 6, Firenze, Firenze, Italy");
    assert.deepEqual(targets[2].bias, { lat: 43.7696, lng: 11.2558 });
    // Ditta's address names no city → falls back to the day's start city (Milan).
    assert.equal(targets[1].query, "Via dei Neri 32r, Milano, Italy");
  });

  it("meals without an address are located by restaurant name (place), not the meal label", () => {
    const input = day({
      id: "oct31",
      city: "osaka",
      meals: [meal({ id: "oct31-meal-1", place: "道頓堀", name: "道頓堀晚餐" })],
      timeline: ["oct31-meal-1"],
    });
    const [target] = mapEntryTargets(input);
    assert.equal(target.name, "道頓堀");
    assert.equal(target.query, "道頓堀, Osaka, Japan");
  });

  it("matches planItems exactly: every timeline entry on the map, no extras", () => {
    const input = day({
      id: "dec22",
      city: "florence",
      spots: [spot({ id: "dec22-sight-1", name: "Accademia" })],
      meals: [meal({ id: "dec22-meal-1", place: "Simbiosi", address: "Via de' Ginori 64r" })],
      hotels: [hotel({ id: "dec22-hotel-1", name: "Grand Hotel Baglioni", address: "Piazza dell'Unità Italiana 6, Firenze" })],
      rides: [{ from: "Hotel", to: "Accademia", mode: "walk", detail: "", price: "", note: "", spot: "", entry: "dec22-sight-1" }],
      timeline: ["dec22-meal-1", "dec22-sight-1", "dec22-hotel-1"],
    });
    const entries = planItems(input).filter((item) => item.kind !== "ride");
    const targets = mapEntryTargets(input);
    assert.equal(targets.length, entries.length);
    assert.deepEqual(
      targets.map((t) => [t.num, t.entry.kind, t.entry.index]),
      entries.map((item) => [(item as { num: number }).num, item.kind, (item as { index: number }).index]),
    );
  });

  it("legacy days (no timeline) still map their spots, in legacy order", () => {
    const input = day({
      id: "old",
      city: "osaka",
      spots: [spot({ id: "old-sight-1", name: "通天閣" }), spot({ id: "old-sight-2", name: "抵達＋輕鬆行" })],
      timeline: [],
    });
    const targets = mapEntryTargets(input);
    assert.deepEqual(
      targets.map((t) => [t.num, t.name, t.query]),
      [
        [1, "通天閣", "通天閣, Osaka, Japan"],
        [2, "抵達＋輕鬆行", null],
      ],
    );
  });

  it("Osaka entries get fallback queries: address, then name, then town without house number", () => {
    const input = day({
      id: "oct31",
      city: "osaka",
      spots: [spot({ id: "oct31-sight-1", name: "大阪城公園／天守閣", address: "中央區大阪城1-1；JR環狀線 大阪城公園站" })],
      hotels: [
        hotel({ id: "oct31-hotel-1", name: "HOTEL MYSTAYS PREMIER Dojima（返酒店）", address: "大阪市北區曽根崎新地 2-4-1（堂島一帶）" }),
      ],
      timeline: ["oct31-sight-1", "oct31-hotel-1"],
    });
    const [castle, hotelTarget] = mapEntryTargets(input);
    assert.equal(castle.query, "中央区大阪城1-1, Osaka, Japan");
    assert.deepEqual(castle.fallbackQueries, ["大阪城公園 天守閣, Osaka, Japan", "大阪城, Osaka, Japan"]);
    assert.equal(hotelTarget.query, "大阪市北区曽根崎新地 2-4-1, Osaka, Japan");
    assert.deepEqual(hotelTarget.fallbackQueries, [
      "HOTEL MYSTAYS PREMIER Dojima, Osaka, Japan",
      "曽根崎新地, Osaka, Japan",
    ]);
  });

  it("ARCHI gets a town-only fallback: Photon chokes on the full house number", () => {
    const input = day({
      id: "nov1",
      city: "kyoto",
      meals: [
        meal({ id: "nov1-meal-1", place: "ARCHI coffee and wine", address: "京都市中京區壬生高樋町65-21（Hankyu 西院站步行約10–13分鐘）" }),
      ],
      timeline: ["nov1-meal-1"],
    });
    const [target] = mapEntryTargets(input);
    assert.equal(target.query, "京都市中京区壬生高樋町65-21, Kyoto, Japan");
    assert.deepEqual(target.fallbackQueries, ["ARCHI coffee and wine, Kyoto, Japan", "壬生高樋町, Kyoto, Japan"]);
  });
});
