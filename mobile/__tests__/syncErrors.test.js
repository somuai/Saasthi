import { formatSyncFailureMessage, formatSyncPushErrors } from "../src/utils/syncErrors";

describe("syncErrors", () => {
  it("formats push errors", () => {
    const msg = formatSyncPushErrors([{ table: "patients", id: "p1", error: "cannot push patient for another worker" }]);
    expect(msg).toContain("patients");
    expect(msg).toContain("another worker");
  });

  it("formats offline pilot reason", () => {
    expect(formatSyncFailureMessage("offline_pilot_no_token")).toContain("OTP");
  });
});
