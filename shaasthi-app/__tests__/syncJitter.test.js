import { sleep, syncJitterMs } from "../src/utils/syncJitter";

describe("syncJitter", () => {
  it("returns value in 0..maxMs range", () => {
    for (let i = 0; i < 20; i += 1) {
      const ms = syncJitterMs(60_000);
      expect(ms).toBeGreaterThanOrEqual(0);
      expect(ms).toBeLessThan(60_000);
    }
  });

  it("sleep resolves", async () => {
    const start = Date.now();
    await sleep(10);
    expect(Date.now() - start).toBeGreaterThanOrEqual(5);
  });
});
