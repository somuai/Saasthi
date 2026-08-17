const store = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((k) => Promise.resolve(store[k] ?? null)),
  setItem: jest.fn((k, v) => {
    store[k] = v;
    return Promise.resolve();
  }),
}));

jest.mock("react-redux", () => ({
  useSelector: jest.fn(() => undefined),
}));

import { getStoredLocale, setStoredLocale, LOCALE_KEY } from "../src/utils/locale";
import { localizeEntry, localizePair, translateHindiText } from "../src/utils/localization";

const DEVANAGARI_RE = /[\u0900-\u097F]/;

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

  it("translates Hindi UI copy to Bengali when Bangla is selected", async () => {
    await setStoredLocale("bn");

    expect(translateHindiText("साइन इन करें", "bn")).toBe("সাইন ইন করুন");
    expect(localizePair("मोबाइल नंबर", "Mobile Number", "bn")).toBe("মোবাইল নম্বর / Mobile Number");
    expect(localizeEntry({ hi: "गर्भवती", en: "Pregnant" }, "bn")).toBe("গর্ভবতী");
    expect(translateHindiText("आपके +91 XXXXXX1234 पर OTP भेजा गया है", "bn")).toBe("আপনার +91 XXXXXX1234-এ OTP পাঠানো হয়েছে");
  });

  it("does not leak Hindi glyphs for common Bengali UI paths", () => {
    const commonHindiStrings = [
      "सिंक और सेटिंग",
      "मरीज प्रोफाइल",
      "गर्भावस्था डैशबोर्ड",
      "भेंट प्रकार / Visit type",
      "अभी सिंक करें / Sync Now",
      "फॉलो-अप शेड्यूल करें",
      "जोखिम कारण",
      "ये कदम उठाएं",
      "सभी कदम पूरे / All steps done",
    ];

    for (const text of commonHindiStrings) {
      expect(translateHindiText(text, "bn")).not.toMatch(DEVANAGARI_RE);
    }
  });
});
