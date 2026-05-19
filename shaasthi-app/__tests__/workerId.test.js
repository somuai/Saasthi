import { getWorkerServerId } from "../src/utils/workerId";

describe("getWorkerServerId", () => {
  it("prefers auth user id", () => {
    expect(getWorkerServerId({ user: { id: 42 }, workerData: { serverId: "local-asha-worker" } })).toBe("42");
  });

  it("uses worker serverId when not local placeholder", () => {
    expect(getWorkerServerId({ user: null, workerData: { serverId: "99" } })).toBe("99");
  });
});
