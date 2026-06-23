import { describe, it, expect } from "vitest";

import {
  findDuplicateFieldKeys,
  validateField,
  validateForm,
} from "./validation";
import type { FormField, FormSchema } from "../types";

const field = (over: Partial<FormField> & Pick<FormField, "type" | "name">): FormField => over;

describe("validateField", () => {
  it("flags a required, empty field", () => {
    expect(validateField(field({ type: "text", name: "foo", isRequired: true }), {})).toBe("required");
  });

  it("does not type-check an empty optional field", () => {
    expect(validateField(field({ type: "email", name: "e" }), {})).toBeNull();
  });

  it("validates email", () => {
    expect(validateField(field({ type: "email", name: "e" }), { e: "bad" })).toBe("email");
    expect(validateField(field({ type: "email", name: "e" }), { e: "a@b.co" })).toBeNull();
  });

  it("validates number", () => {
    expect(validateField(field({ type: "number", name: "n" }), { n: "abc" })).toBe("number");
    expect(validateField(field({ type: "number", name: "n" }), { n: "5" })).toBeNull();
  });

  it("validates url via inputType", () => {
    expect(validateField(field({ type: "text", name: "u", inputType: "url" }), { u: "nope" })).toBe("url");
    expect(validateField(field({ type: "text", name: "u", inputType: "url" }), { u: "https://a.bc/x" })).toBeNull();
  });
});

describe("findDuplicateFieldKeys", () => {
  it("returns duplicated names", () => {
    const schema: FormSchema = {
      pages: [{ name: "p", elements: [field({ type: "text", name: "foo" }), field({ type: "text", name: "foo" })] }],
    };
    expect(findDuplicateFieldKeys(schema)).toEqual(["foo"]);
  });

  it("returns [] when unique", () => {
    const schema: FormSchema = {
      pages: [{ name: "p", elements: [field({ type: "text", name: "a" }), field({ type: "text", name: "b" })] }],
    };
    expect(findDuplicateFieldKeys(schema)).toEqual([]);
  });
});

describe("validateForm", () => {
  it("aggregates errors and skips hidden fields", () => {
    const fields: FormField[] = [
      field({ type: "text", name: "a", isRequired: true }),
      field({ type: "text", name: "b", isRequired: true, visibleIf: "{a} = 'x'" }),
    ];
    expect(validateForm(fields, {})).toEqual({ a: "required" });
  });
});
