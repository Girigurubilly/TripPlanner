import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  estimateMinutesFromKm,
  parseMapsCoords,
  roundTravelMinutes,
  speedKmhForMode,
} from "./travel-eta.ts";
import { stopClockLabel, type StopSchedule } from "./trip.ts";

describe("travel-eta math", () => {
  it("parses @lat,lng and !3d!4d from Maps URLs", () => {
    assert.deepEqual(parseMapsCoords("https://www.google.com/maps/place/Foo/@34.66,135.50,17z"), {
      lat: 34.66,
      lng: 135.5,
    });
    assert.deepEqual(
      parseMapsCoords("https://www.google.com/maps/place/Foo/data=!3d35.0116!4d135.7681"),
      { lat: 35.0116, lng: 135.7681 },
    );
    assert.equal(parseMapsCoords("not a map"), null);
  });

  it("uses mode speeds and rounds to friendly minutes", () => {
    assert.equal(speedKmhForMode("步行"), 4.5);
    assert.equal(speedKmhForMode("地鐵"), 25);
    assert.equal(speedKmhForMode("的士"), 30);
    assert.equal(roundTravelMinutes(1.2), 1);
    assert.equal(roundTravelMinutes(4.4), 4);
    assert.equal(roundTravelMinutes(12), 10);
    assert.equal(roundTravelMinutes(13), 15);
    // 0.75 km walk at 4.5 km/h ≈ 10 min
    assert.equal(estimateMinutesFromKm(0.75, "步行"), 10);
    // 3 km metro at 25 km/h ≈ 7.2 → rounds to nearest 5 above 7
    assert.equal(estimateMinutesFromKm(3, "地鐵"), 5);
    // 5 km metro ≈ 12 min → 10
    assert.equal(estimateMinutesFromKm(5, "地鐵"), 10);
  });
});

describe("stopClockLabel", () => {
  it("formats arrive/leave and skips when no arrive", () => {
    const full: StopSchedule = {
      entryId: "a",
      travelBeforeMin: 10,
      dwellMin: 60,
      arriveMin: 9 * 60 + 30,
      leaveMin: 10 * 60 + 30,
    };
    assert.equal(stopClockLabel(full), "09:30–10:30");
    assert.equal(stopClockLabel({ ...full, leaveMin: null }), "到 09:30");
    assert.equal(stopClockLabel({ ...full, arriveMin: null, leaveMin: null }), "");
    assert.equal(stopClockLabel(null), "");
  });
});
