const store = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((k) => Promise.resolve(store[k] ?? null)),
  setItem: jest.fn((k, v) => {
    store[k] = v;
    return Promise.resolve();
  }),
  multiRemove: jest.fn((keys) => {
    keys.forEach((k) => delete store[k]);
    return Promise.resolve();
  }),
}));

const secure = {};
jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn((k, v) => {
    secure[k] = v;
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((k) => {
    delete secure[k];
    return Promise.resolve();
  }),
}));

import {
  AUTH_PENDING_LOCALE_KEY,
  AUTH_PENDING_PHONE_KEY,
  AUTH_USER_KEY,
  AUTH_WORKER_KEY,
  clearAuthSession,
  clearPendingLogin,
  isInvalidOtpError,
  persistAuthSession,
  persistAuthTokens,
  persistPendingLogin,
  readPendingLogin,
  shouldFallbackToOfflinePilot,
} from "../src/features/auth/authSession";

describe("authSession", () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    Object.keys(secure).forEach((k) => delete secure[k]);
  });

  it("persists user and worker JSON", async () => {
    const user = { id: "u1", phone: "+919000000000", language: "hi" };
    const worker = { serverId: "w1", name: "ASHA" };
    await persistAuthSession(user, worker);
    expect(JSON.parse(store[AUTH_USER_KEY])).toEqual(user);
    expect(JSON.parse(store[AUTH_WORKER_KEY])).toEqual(worker);
  });

  it("persists JWT tokens in SecureStore", async () => {
    await persistAuthTokens({ access: "a1", refresh: "r1" });
    expect(secure.accessToken).toBe("a1");
    expect(secure.refreshToken).toBe("r1");
  });

  it("clearAuthSession removes AsyncStorage and SecureStore", async () => {
    await persistAuthSession({ id: "u1" }, { serverId: "w1" });
    await persistAuthTokens({ access: "a1", refresh: "r1" });
    await clearAuthSession();
    expect(store[AUTH_USER_KEY]).toBeUndefined();
    expect(store[AUTH_WORKER_KEY]).toBeUndefined();
    expect(secure.accessToken).toBeUndefined();
    expect(secure.refreshToken).toBeUndefined();
  });

  it("persists pending phone/locale between login and OTP", async () => {
    await persistPendingLogin({ phone: "9876543210", locale: "en" });
    await expect(readPendingLogin()).resolves.toEqual({ phone: "9876543210", locale: "en" });
    await clearPendingLogin();
    await expect(readPendingLogin()).resolves.toEqual({ phone: "", locale: "hi" });
  });

  it("clearAuthSession removes pending login keys", async () => {
    await persistPendingLogin({ phone: "9876543210", locale: "hi" });
    await clearAuthSession();
    expect(store[AUTH_PENDING_PHONE_KEY]).toBeUndefined();
    expect(store[AUTH_PENDING_LOCALE_KEY]).toBeUndefined();
  });

  it("classifies OTP errors for offline fallback", () => {
    expect(shouldFallbackToOfflinePilot({ message: "Network Error" })).toBe(true);
    expect(shouldFallbackToOfflinePilot({ response: { status: 400 } })).toBe(false);
    expect(isInvalidOtpError({ response: { status: 400 } })).toBe(true);
    expect(isInvalidOtpError({ response: { status: 500 } })).toBe(false);
    expect(isInvalidOtpError({ response: { status: 404 } })).toBe(false);
  });
});
