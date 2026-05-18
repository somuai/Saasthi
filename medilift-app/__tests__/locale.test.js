const store = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((k) => Promise.resolve(store[k] ?? null)),
  setItem: jest.fn((k, v) => {
    store[k] = v;
    return Promise.resolve();
  }),
}));

import { getStoredLocale, setStoredLocale, LOCALE_KEY } from "../src/utils/locale";

describe("locale persistence", () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
  });

  it("defaults to hi", async () => {
    expect(await getStoredLocale()).toBe("hi");
  });

  it("persists selection", async () => {
    await setStoredLocale("en");
    expect(store[LOCALE_KEY]).toBe("en");
    expect(await getStoredLocale()).toBe("en");
  });
});
