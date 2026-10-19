import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { wishUpdatePrompt } from "./ai-prompt.ts";

describe("wish update prompt", () => {
  it("asks for one updated file and keeps the same trip id", () => {
    const text = wishUpdatePrompt(
      { id: "osaka-2026-04", title: "大阪散步" },
      [{ dayId: "d1", kind: "souvenir", name: "黑門市場", note: "順路" }],
      { d1: "4/2 抵達" },
      { id: "osaka-2026-04", title: "大阪散步" },
    );
    assert.match(text, /osaka-2026-04/);
    assert.match(text, /手信店/);
    assert.match(text, /黑門市場/);
    assert.match(text, /4\/2 抵達/);
    assert.match(text, /只輸出一個 JSON/);
  });
});
