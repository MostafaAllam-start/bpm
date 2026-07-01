import { describe, it, expect } from "vitest";
import { slugifyName, requestReducer, REQUEST_INIT } from "./requestReducer";
import type { HttpRequest } from "../../../types/index.ts";

const baseRequest = (): HttpRequest => ({
  id: "r1",
  name: "Request 1",
  method: "GET",
  url: "",
  headers: [],
  responsePath: "",
  isList: false,
  outputRules: [],
});

describe("slugifyName", () => {
  it("converts spaced words to camelCase", () => {
    expect(slugifyName("Get Users")).toBe("getUsers");
    expect(slugifyName("Fetch User Data")).toBe("fetchUserData");
  });

  it("lowercases the first word", () => {
    expect(slugifyName("MyRequest")).toBe("myRequest");
    expect(slugifyName("Request")).toBe("request");
  });

  it("strips punctuation and special characters", () => {
    expect(slugifyName("my request!")).toBe("myRequest");
    // hyphen is stripped but not treated as a word separator → joined as one lowercase word
    expect(slugifyName("get-users")).toBe("getusers");
    expect(slugifyName("api (v2)")).toBe("apiV2");
  });

  it("falls back to 'response' for empty or whitespace-only input", () => {
    expect(slugifyName("")).toBe("response");
    expect(slugifyName("   ")).toBe("response");
    expect(slugifyName("!!!")).toBe("response");
  });

  it("handles single words", () => {
    expect(slugifyName("users")).toBe("users");
    expect(slugifyName("USERS")).toBe("uSERS");
  });

  it("handles underscore-separated words", () => {
    expect(slugifyName("get_user_data")).toBe("getUserData");
  });
});

describe("requestReducer — SET_NAME", () => {
  it("auto-updates responseVar when it still matches the old auto-slug", () => {
    const state = {
      ...REQUEST_INIT,
      name: "Get Users",
      responseVar: "getUsers",
    };
    const next = requestReducer(state, { type: "SET_NAME", value: "Fetch Users" });
    expect(next.name).toBe("Fetch Users");
    expect(next.responseVar).toBe("fetchUsers");
  });

  it("does NOT update responseVar when it was manually changed", () => {
    const state = {
      ...REQUEST_INIT,
      name: "Get Users",
      responseVar: "myCustomVar",
    };
    const next = requestReducer(state, { type: "SET_NAME", value: "Fetch Users" });
    expect(next.responseVar).toBe("myCustomVar");
  });

  it("auto-updates responseVar when name is cleared", () => {
    const state = {
      ...REQUEST_INIT,
      name: "Get Users",
      responseVar: "getUsers",
    };
    const next = requestReducer(state, { type: "SET_NAME", value: "" });
    expect(next.responseVar).toBe("response");
  });
});

describe("requestReducer — RESET", () => {
  it("seeds responseVar from the saved request", () => {
    const req: HttpRequest = { ...baseRequest(), name: "Get Users", responseVar: "savedVar" };
    const next = requestReducer(REQUEST_INIT, { type: "RESET", request: req });
    expect(next.responseVar).toBe("savedVar");
  });

  it("auto-derives responseVar from name when not saved", () => {
    const req: HttpRequest = { ...baseRequest(), name: "Get Users" };
    const next = requestReducer(REQUEST_INIT, { type: "RESET", request: req });
    expect(next.responseVar).toBe("getUsers");
  });

  it("restores all fields from the request", () => {
    const req: HttpRequest = {
      ...baseRequest(),
      name: "Post Data",
      nameAr: "إرسال بيانات",
      method: "POST",
      url: "https://api.example.com",
      body: '{"key": "value"}',
      responsePath: "data.items",
      responseVar: "postData",
      isList: true,
      listItemKey: "id",
      listItemLabel: "name",
    };
    const next = requestReducer(REQUEST_INIT, { type: "RESET", request: req });
    expect(next.name).toBe("Post Data");
    expect(next.nameAr).toBe("إرسال بيانات");
    expect(next.method).toBe("POST");
    expect(next.url).toBe("https://api.example.com");
    expect(next.body).toBe('{"key": "value"}');
    expect(next.responsePath).toBe("data.items");
    expect(next.isList).toBe(true);
    expect(next.listItemKey).toBe("id");
    expect(next.listItemLabel).toBe("name");
  });
});

describe("requestReducer — SET_RESPONSE_VAR", () => {
  it("updates the responseVar manually", () => {
    const state = { ...REQUEST_INIT, responseVar: "auto" };
    const next = requestReducer(state, { type: "SET_RESPONSE_VAR", value: "myVar" });
    expect(next.responseVar).toBe("myVar");
  });
});
