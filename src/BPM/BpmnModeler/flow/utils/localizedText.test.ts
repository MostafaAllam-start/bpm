import { describe, expect, it } from "vitest";

import { AR_SUFFIX, localizedValue } from "./localizedText.ts";

describe("localizedValue", () => {
  it("uses the default value for non-Arabic languages", () => {
    expect(localizedValue("Start", "البداية", "en")).toBe("Start");
    expect(localizedValue("Start", "البداية", "en-US")).toBe("Start");
  });

  it("uses the Arabic variant when the language is Arabic", () => {
    expect(localizedValue("Start", "البداية", "ar")).toBe("البداية");
    expect(localizedValue("Start", "البداية", "ar-EG")).toBe("البداية");
  });

  it("falls back to the other language when the preferred side is blank", () => {
    // Arabic requested but only the default is filled.
    expect(localizedValue("Start", "", "ar")).toBe("Start");
    expect(localizedValue("Start", "   ", "ar")).toBe("Start");
    // English requested but only the Arabic is filled.
    expect(localizedValue("", "البداية", "en")).toBe("البداية");
    expect(localizedValue(undefined, "البداية", "en")).toBe("البداية");
  });

  it("returns an empty string when neither side has a value", () => {
    expect(localizedValue("", "", "ar")).toBe("");
    expect(localizedValue(undefined, undefined, "en")).toBe("");
  });

  it("exposes the Arabic prop suffix", () => {
    expect(`name${AR_SUFFIX}`).toBe("nameAr");
  });
});
