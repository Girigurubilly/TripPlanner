import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cityLabel, dayChipParts, dayKey } from "./trip.ts";

describe("day chip and key", () => {
  it("uses the day number after the slash", () => {
    assert.equal(dayChipParts({ label: "4/2（五）", city: "osaka" }).num, "2");
    assert.equal(dayChipParts({ label: "4/3（六）", city: "osaka" }).num, "3");
    assert.equal(dayChipParts({ label: "12/25 聖誕", city: "osaka" }).num, "25");
    assert.equal(dayChipParts({ label: "4月2日", city: "osaka" }).num, "2");
  });

  it("matches rationale labels with slash dates", () => {
    assert.equal(dayKey("4/2（五）"), "m4d2");
    assert.equal(dayKey("4/2"), "m4d2");
    assert.equal(dayKey("4/3（六）"), "m4d3");
    assert.equal(dayKey("4月3日"), "m4d3");
  });

  it("shows Chinese city labels", () => {
    assert.equal(cityLabel("lisbon"), "里斯本");
    assert.equal(cityLabel("osaka"), "大阪");
    assert.equal(cityLabel("大阪"), "大阪");
  });
});
