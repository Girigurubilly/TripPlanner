import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  acceptResult,
  districtOfQuery,
  mapQuery,
  townOfAddress,
  toJapaneseQuery,
} from "./geocode.ts";

describe("mapQuery", () => {
  it("cleans CJK addresses: drops the transit note, converts Traditional kanji", () => {
    assert.equal(mapQuery("中央區大阪城1-1；JR環狀線 大阪城公園站", "osaka"), "中央区大阪城1-1, Osaka, Japan");
    assert.equal(
      mapQuery("大阪市北區曽根崎新地 2-4-1（堂島一帶）", "osaka"),
      "大阪市北区曽根崎新地 2-4-1, Osaka, Japan",
    );
    assert.equal(mapQuery("永觀堂（Eikando）", "kyoto"), "永観堂, Kyoto, Japan");
    assert.equal(mapQuery("南禪寺 水路閣", "kyoto"), "南禅寺 水路閣, Kyoto, Japan");
    assert.equal(mapQuery("NU茶屋町 4F（2025年2月由3F搬上4F）", "osaka"), "NU茶屋町 4F, Osaka, Japan");
    assert.equal(mapQuery("京都市中京區壬生高樋町65-21（Hankyu 西院站步行約10–13分鐘）", "kyoto"), "京都市中京区壬生高樋町65-21, Kyoto, Japan");
  });

  it("keeps distinct CJK addresses distinct (no shared mangled query)", () => {
    // The old Latin extraction shredded both of these to digit fragments
    // ("1-1 JR" / "1-1-88 JR") that the geocoder resolved to the same
    // wrong JR Namba coordinate.
    const castle = mapQuery("中央區大阪城1-1；JR環狀線 大阪城公園站", "osaka");
    const sky = mapQuery("北區大淀中1-1-88；JR大阪站步行約7分鐘", "osaka");
    assert.notEqual(castle, sky);
    assert.match(castle, /大阪城1-1/);
    assert.match(sky, /大淀中1-1-88/);
  });

  it("Latin-script text keeps the old behaviour (CJK descriptors dropped)", () => {
    assert.equal(mapQuery("Teatro alla Scala 聖誕音樂會（晚間 20:00）", "milan"), "Teatro alla Scala, Milano, Italy");
    assert.equal(mapQuery("Via Brera 28, Milano", "milan"), "Via Brera 28, Milano, Milano, Italy");
    assert.equal(
      mapQuery("HOTEL MYSTAYS PREMIER Dojima（check-in）", "osaka"),
      "HOTEL MYSTAYS PREMIER Dojima, Osaka, Japan",
    );
  });
});

describe("toJapaneseQuery", () => {
  it("converts Traditional variant kanji to Japanese shinjitai", () => {
    assert.equal(toJapaneseQuery("中央區大阪城 觀禪會"), "中央区大阪城 観禅会");
  });
});

describe("districtOfQuery", () => {
  it("extracts the Japanese district from an address query", () => {
    assert.equal(districtOfQuery("大阪市北区曽根崎新地 2-4-1, Osaka, Japan"), "北区");
    assert.equal(districtOfQuery("京都市中京区壬生高樋町65-21, Kyoto, Japan"), "中京区");
    assert.equal(districtOfQuery("北区大淀中1-1-88, Osaka, Japan"), "北区");
    assert.equal(districtOfQuery("Via Brera 28, Milano, Milano, Italy"), null);
  });
});

describe("townOfAddress", () => {
  it("extracts the bare town from a Japanese address", () => {
    assert.equal(townOfAddress("京都市中京区壬生高樋町65-21"), "壬生高樋町");
    assert.equal(townOfAddress("大阪市北区曽根崎新地 2-4-1"), "曽根崎新地");
    assert.equal(townOfAddress("中央區大阪城1-1；JR環狀線 大阪城公園站"), "大阪城");
    assert.equal(townOfAddress("左京區南禪寺福地町；永觀堂步行約5–10分鐘"), "南禅寺福地町");
  });

  it("returns null when there is no town part", () => {
    assert.equal(townOfAddress("Via Brera 28, Milano"), null);
    assert.equal(townOfAddress("Piazza di Santa Croce, 50122 Firenze"), null);
  });
});

describe("acceptResult", () => {
  const osaka = { lat: 34.6937, lng: 135.5023 };
  const hotelQuery = "大阪市北区曽根崎新地 2-4-1, Osaka, Japan";

  it("rejects city-level fallbacks", () => {
    assert.equal(
      acceptResult({ point: { lat: 35.0116, lng: 135.7681 }, district: null, coarse: true }, "左京区永観堂町48, Kyoto, Japan", {
        lat: 35.0116,
        lng: 135.7681,
      }),
      false,
    );
  });

  it("rejects results impossibly far from the entry's city (Fukuoka café for an Osaka entry)", () => {
    assert.equal(
      acceptResult(
        { point: { lat: 33.5896, lng: 130.3984 }, district: null, coarse: false },
        "café & books bibliothèque, Osaka, Japan",
        osaka,
      ),
      false,
    );
  });

  it("rejects results in a different district than the address names (same-number address across town)", () => {
    // Photon returns Radio Osaka (港区) for the Dojima hotel address (北区).
    assert.equal(
      acceptResult({ point: { lat: 34.6696, lng: 135.4607 }, district: "港区", coarse: false }, hotelQuery, osaka),
      false,
    );
    // And Honmachi (東山区) for the ARCHI address (中京区).
    assert.equal(
      acceptResult(
        { point: { lat: 34.9718, lng: 135.7708 }, district: "東山区", coarse: false },
        "京都市中京区壬生高樋町65-21, Kyoto, Japan",
        { lat: 35.0116, lng: 135.7681 },
      ),
      false,
    );
  });

  it("accepts a believable result, with or without a district to check", () => {
    assert.equal(
      acceptResult(
        { point: { lat: 34.7055, lng: 135.4906 }, district: "北区", coarse: false },
        "北区大淀中1-1-88, Osaka, Japan",
        osaka,
      ),
      true,
    );
    assert.equal(
      acceptResult({ point: { lat: 34.6974, lng: 135.4942 }, district: null, coarse: false }, hotelQuery, osaka),
      true,
    );
    assert.equal(
      acceptResult(
        { point: { lat: 45.4642, lng: 9.19 }, district: null, coarse: false },
        "Via Brera 28, Milano, Milano, Italy",
        { lat: 45.4642, lng: 9.19 },
      ),
      true,
    );
  });
});
