import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { placeFromMaps } from "./maps-place.ts";

describe("maps place", () => {
  it("reads the place name from a Google Maps link", () => {
    const parsed = placeFromMaps("https://www.google.com/maps/place/%E9%BB%91%E9%96%80%E5%B8%82%E5%A0%B4/@34.66,135.50,17z");
    assert.equal(parsed?.name, "黑門市場");
  });

  it("uses the title copied above a short link", () => {
    const parsed = placeFromMaps("黑門市場\n大阪市浪速區\nhttps://maps.app.goo.gl/abc123");
    assert.equal(parsed?.name, "黑門市場");
    assert.equal(parsed?.note, "大阪市浪速區");
  });

  it("ignores a plain shop name", () => {
    assert.equal(placeFromMaps("黑門市場"), null);
  });
});
