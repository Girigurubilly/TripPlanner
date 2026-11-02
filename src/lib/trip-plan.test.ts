import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDayPlace,
  clampDwell,
  dayDwellStats,
  dayDwellTotal,
  dayOrder,
  daySchedule,
  dayTravelTotal,
  directionsUrl,
  formatClock,
  formatDwell,
  mapLink,
  minutesFromDetail,
  moveDayEntry,
  normalizeStartTime,
  parseTripBook,
  planEntries,
  planItems,
  promoteWishToDay,
  removeDayEntry,
  reorderDayTimeline,
  rideForEntry,
  rideTravelMin,
  setDayStartTime,
  setEntryDwell,
  setLegTravel,
  shiftVisitsOnRemove,
  type TripBook,
} from "./trip.ts";
import { planningPackPrompt } from "./ai-prompt.ts";

function legacy(): TripBook {
  return parseTripBook({
    schemaVersion: 1,
    id: "osaka-test",
    title: "大阪",
    days: [
      {
        id: "d1",
        city: "osaka",
        label: "4/2",
        title: "難波",
        spots: [{ name: "A" }, { name: "B" }],
        meals: [{ slot: "午餐", place: "M" }],
        rides: [{ from: "酒店", to: "B", mode: "步行", spot: "B" }],
      },
      { id: "d2", city: "osaka", label: "4/3", title: "空", spots: [] },
    ],
  });
}

function timelineBook(): TripBook {
  return parseTripBook({
    schemaVersion: 1,
    id: "t",
    title: "T",
    days: [
      {
        id: "d1",
        city: "osaka",
        label: "4/2",
        title: "x",
        spots: [{ id: "s1", name: "S1", dwellMin: 60 }, { id: "s2", name: "S2" }],
        meals: [{ id: "m1", place: "M1", dwellMin: "45" }],
        hotels: [{ id: "h1", name: "H" }],
        timeline: ["s1", "m1", "s2", "h1"],
      },
    ],
  });
}

describe("dwellMin schema", () => {
  it("parses, clamps and tolerates missing", () => {
    const day = timelineBook().days[0];
    assert.equal(day.spots[0].dwellMin, 60);
    assert.equal(day.spots[1].dwellMin, undefined);
    assert.equal(day.meals[0].dwellMin, 45);
    assert.equal(clampDwell(9999), 720);
    assert.equal(clampDwell(-5), 0);
    assert.equal(clampDwell("abc"), 0);
    assert.equal(clampDwell(29.6), 30);
  });

  it("survives a save/load round trip", () => {
    const trip = setEntryDwell(timelineBook(), "d1", "s2", 90);
    const again = parseTripBook(JSON.parse(JSON.stringify(trip)));
    assert.equal(again.days[0].spots[1].dwellMin, 90);
    assert.deepEqual(again.days[0].timeline, ["s1", "m1", "s2", "h1"]);
  });
});

describe("addDayPlace", () => {
  it("creates a timeline for a legacy day in legacy order, then appends", () => {
    const { trip, id } = addDayPlace(legacy(), "d1", {
      kind: "sight",
      name: "黑門市場",
      address: "大阪市中央區",
      note: "<早上>去",
      dwellMin: 60,
      mapsUrl: "https://maps.app.goo.gl/abc",
    });
    const day = trip.days[0];
    // Legacy route shows B (ride) first, then A; then meals.
    assert.deepEqual(day.timeline.slice(0, 3), [day.spots[1].id, day.spots[0].id, day.meals[0].id]);
    assert.equal(day.timeline.at(-1), id);
    const added = day.spots.at(-1)!;
    assert.equal(added.name, "黑門市場");
    assert.equal(added.dwellMin, 60);
    assert.equal(added.html, "<p>&lt;早上&gt;去</p>");
    assert.equal(mapLink(added), "https://maps.app.goo.gl/abc");
    // Name-only ride got paired to its entry so it still precedes B.
    const route = planItems(day);
    assert.equal(route[0].kind, "ride");
    assert.deepEqual(route[1], { kind: "spot", index: 1, num: 1 });
  });

  it("adds a meal with place = name and works on an empty day", () => {
    const { trip, id } = addDayPlace(legacy(), "d2", { kind: "meal", name: "一蘭", dwellMin: 0 });
    const day = trip.days[1];
    assert.deepEqual(day.timeline, [id]);
    assert.equal(day.meals[0].place, "一蘭");
    assert.equal(day.meals[0].dwellMin, undefined);
  });

  it("ignores blank names and unknown days", () => {
    const base = legacy();
    assert.equal(addDayPlace(base, "d1", { kind: "sight", name: "  " }).trip, base);
    assert.equal(addDayPlace(base, "nope", { kind: "sight", name: "x" }).id, "");
  });

  it("drops non-Maps urls", () => {
    const { trip } = addDayPlace(legacy(), "d2", { kind: "sight", name: "x", mapsUrl: "javascript:alert(1)" });
    assert.equal(trip.days[1].spots[0].mapsUrl, undefined);
  });
});

describe("reorder / remove / dwell totals", () => {
  it("reorders only known ids and keeps the rest", () => {
    const trip = reorderDayTimeline(timelineBook(), "d1", ["s2", "ghost", "s1", "s2"]);
    assert.deepEqual(trip.days[0].timeline, ["s2", "s1", "m1", "h1"]);
  });

  it("moves an entry up and down", () => {
    let trip = moveDayEntry(timelineBook(), "d1", "s2", -1);
    assert.deepEqual(trip.days[0].timeline, ["s1", "s2", "m1", "h1"]);
    trip = moveDayEntry(trip, "d1", "s1", -1);
    assert.deepEqual(trip.days[0].timeline, ["s1", "s2", "m1", "h1"]);
  });

  it("removes from arrays, timeline and paired ride", () => {
    const base = parseTripBook({
      schemaVersion: 1,
      id: "r",
      title: "R",
      days: [{ id: "d1", city: "x", label: "1", title: "1", spots: [{ id: "a", name: "A" }, { id: "b", name: "B" }], timeline: ["a", "b"], rides: [{ from: "A", to: "B", mode: "步行", entry: "b" }] }],
    });
    const trip = removeDayEntry(base, "d1", "b");
    assert.deepEqual(trip.days[0].timeline, ["a"]);
    assert.equal(trip.days[0].spots.length, 1);
    assert.equal(trip.days[0].rides.length, 0);
  });

  it("shifts check-ins after a removal", () => {
    const visits = { "d1:0": "t0", "d1:1": "t1", "d1:2": "t2", "d1:meal-0": "m", "d2:1": "x" };
    assert.deepEqual(shiftVisitsOnRemove(visits, "d1", { kind: "spot", index: 1 }), { "d1:0": "t0", "d1:1": "t2", "d1:meal-0": "m", "d2:1": "x" });
  });

  it("sums dwell and counts unset places", () => {
    let trip = timelineBook();
    assert.equal(dayDwellTotal(trip.days[0]), 105);
    assert.deepEqual(dayDwellStats(trip.days[0]), { total: 105, set: 2, unset: 1 });
    trip = setEntryDwell(trip, "d1", "s1", null);
    assert.equal(trip.days[0].spots[0].dwellMin, undefined);
    assert.equal(formatDwell(150), "2 小時 30 分");
    assert.equal(formatDwell(45), "45 分");
    assert.equal(formatDwell(120), "2 小時");
  });

  it("lists plan entries in order with notes", () => {
    const entries = planEntries(legacy().days[0]);
    assert.deepEqual(entries.map((entry) => entry.name), ["B", "A", "M"]);
    assert.deepEqual(dayOrder(legacy().days[0]).length, 3);
  });

  it("promotes a souvenir wish as a tagged sight", () => {
    const { trip, id } = promoteWishToDay(legacy(), { id: "w", dayId: "d2", kind: "souvenir", name: "手信店", note: "" }, 30);
    const spot = trip.days[1].spots.find((item) => item.id === id)!;
    assert.equal(spot.badge, "手信");
    assert.equal(spot.dwellMin, 30);
  });
});

describe("planning pack prompt", () => {
  it("lists ordered places with dwell and asks for the same trip id", () => {
    const trip = timelineBook();
    const day = trip.days[0];
    const text = planningPackPrompt(trip, [{ id: day.id, label: day.label, title: day.title, entries: planEntries(day) }], trip);
    assert.match(text, /id 必須維持「t」/);
    assert.match(text, /1\. 景點｜S1｜停留約 60 分鐘/);
    assert.match(text, /2\. 餐廳｜M1｜停留約 45 分鐘/);
    assert.match(text, /3\. 景點｜S2｜停留時間未定/);
    assert.match(text, /已估停留共 105 分鐘/);
    assert.match(text, /dwellMin/);
    assert.match(text, /travelMin/);
    assert.match(text, /只輸出一個 JSON/);
  });

  it("includes start time, travel legs and clock windows", () => {
    let trip = timelineBook();
    trip = setDayStartTime(trip, "d1", "9:30");
    trip = setLegTravel(trip, "d1", "m1", { travelMin: 15, mode: "地鐵" });
    trip = setLegTravel(trip, "d1", "s2", { travelMin: 10, mode: "步行", note: "經商店街" });
    const day = trip.days[0];
    const schedule = daySchedule(day);
    const entries = planEntries(day).map((entry, index) => {
      const stop = schedule.stops[index];
      const ride = rideForEntry(day, entry.id);
      return {
        ...entry,
        travelBeforeMin: stop?.travelBeforeMin || 0,
        travelMode: ride?.mode || "",
        travelNote: ride?.note || "",
        arrive: stop?.arriveMin != null ? formatClock(stop.arriveMin) : "",
        leave: stop?.leaveMin != null ? formatClock(stop.leaveMin) : "",
      };
    });
    const text = planningPackPrompt(trip, [{ id: day.id, label: day.label, title: day.title, startTime: day.startTime, entries }], trip);
    assert.match(text, /出發 09:30/);
    assert.match(text, /交通約 15 分鐘（地鐵）/);
    assert.match(text, /交通備註：經商店街/);
    assert.match(text, /時段：09:30–10:30/);
    assert.match(text, /startTime/);
  });
});

describe("leg travel + clock schedule", () => {
  it("parses travelMin and startTime, and keeps detail in sync", () => {
    const trip = parseTripBook({
      schemaVersion: 1,
      id: "x",
      title: "X",
      days: [{
        id: "d1",
        city: "osaka",
        label: "1",
        title: "1",
        startTime: "9:5",
        spots: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
        timeline: ["a", "b"],
        rides: [{ from: "A", to: "B", mode: "步行", detail: "約 12 分鐘", entry: "b" }],
      }],
    });
    assert.equal(trip.days[0].startTime, "09:05");
    assert.equal(trip.days[0].rides[0].travelMin, 12);
    assert.equal(minutesFromDetail("about 20 min"), 20);
    assert.equal(normalizeStartTime("25:00"), "");
  });

  it("sets, clears and totals leg travel on the destination ride", () => {
    let trip = timelineBook();
    trip = setLegTravel(trip, "d1", "m1", { travelMin: 15, mode: "地鐵", note: "轉乘" });
    let ride = rideForEntry(trip.days[0], "m1")!;
    assert.equal(ride.travelMin, 15);
    assert.equal(ride.mode, "地鐵");
    assert.equal(ride.detail, "約 15 分鐘");
    assert.equal(ride.from, "S1");
    assert.equal(ride.to, "M1");
    assert.equal(rideTravelMin(ride), 15);
    assert.equal(dayTravelTotal(trip.days[0]), 15);

    trip = setLegTravel(trip, "d1", "m1", { travelMin: null, mode: "", note: "" });
    assert.equal(rideForEntry(trip.days[0], "m1"), null);
    assert.equal(dayTravelTotal(trip.days[0]), 0);
  });

  it("rebuilds from/to after reorder and drops ride with removed stop", () => {
    let trip = timelineBook();
    trip = setLegTravel(trip, "d1", "s2", { travelMin: 20, mode: "巴士" });
    trip = setLegTravel(trip, "d1", "m1", { travelMin: 8, mode: "步行" });
    trip = reorderDayTimeline(trip, "d1", ["s1", "s2", "m1", "h1"]);
    const toS2 = rideForEntry(trip.days[0], "s2")!;
    assert.equal(toS2.from, "S1");
    assert.equal(toS2.to, "S2");
    assert.equal(toS2.travelMin, 20);
    const toM1 = rideForEntry(trip.days[0], "m1")!;
    assert.equal(toM1.from, "S2");
    assert.equal(toM1.travelMin, 8);

    trip = removeDayEntry(trip, "d1", "s2");
    assert.equal(rideForEntry(trip.days[0], "s2"), null);
    const again = rideForEntry(trip.days[0], "m1")!;
    assert.equal(again.from, "S1");
    assert.equal(again.travelMin, 8);
  });

  it("computes arrive/leave from startTime, travel and dwell", () => {
    let trip = timelineBook();
    trip = setDayStartTime(trip, "d1", "10:00");
    trip = setEntryDwell(trip, "d1", "s2", 30);
    trip = setLegTravel(trip, "d1", "m1", { travelMin: 10, mode: "步行" });
    trip = setLegTravel(trip, "d1", "s2", { travelMin: 20, mode: "地鐵" });
    const schedule = daySchedule(trip.days[0]);
    assert.equal(schedule.startMin, 600);
    assert.equal(formatClock(schedule.stops[0].arriveMin!), "10:00");
    assert.equal(formatClock(schedule.stops[0].leaveMin!), "11:00"); // 60 dwell
    assert.equal(formatClock(schedule.stops[1].arriveMin!), "11:10");
    assert.equal(formatClock(schedule.stops[1].leaveMin!), "11:55"); // 45 dwell
    assert.equal(formatClock(schedule.stops[2].arriveMin!), "12:15");
    assert.equal(formatClock(schedule.stops[2].leaveMin!), "12:45");
    assert.equal(schedule.travelTotal, 30);
    assert.equal(schedule.dwellTotal, 135);
    assert.equal(formatClock(schedule.stops[3].arriveMin!), "12:45");
    assert.equal(schedule.stops[3].leaveMin, null); // hotel has no dwell
    assert.equal(schedule.endMin, null);
  });

  it("builds a Google Maps directions URL", () => {
    const url = directionsUrl("難波站", "心齋橋");
    assert.match(url, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&origin=/);
    assert.match(url, /destination=/);
    assert.equal(directionsUrl("", "x"), "");
  });
});
