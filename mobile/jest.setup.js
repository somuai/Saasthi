jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock("@nozbe/watermelondb", () => ({
  Q: {
    and: jest.fn(),
    or: jest.fn(),
    eq: jest.fn(),
    gte: jest.fn(),
    lte: jest.fn(),
    gt: jest.fn(),
    lt: jest.fn(),
    not: jest.fn(),
  },
  Database: jest.fn(),
  Model: class MockModel {
    static table = "";
  },
}));
