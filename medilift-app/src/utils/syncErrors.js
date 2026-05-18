/** Format saasthi-api sync push error payloads for UI and logs. */
export function formatSyncPushErrors(errors) {
  if (!errors?.length) return null;
  return errors
    .map((e) => {
      const id = e.id ? ` ${e.id}` : "";
      return `${e.table || "table"}${id}: ${e.error || "failed"}`;
    })
    .join(" · ");
}

const SYNC_REASON_HI = {
  offline: "नेटवर्क ऑफलाइन है",
  offline_pilot_no_token: "सर्वर OTP से लॉगिन करें — सिंक उपलब्ध नहीं",
  sync_in_progress: "सिंक पहले से चल रहा है",
};

const SYNC_REASON_EN = {
  offline: "Network is offline",
  offline_pilot_no_token: "Log in with server OTP to enable sync",
  sync_in_progress: "Sync already in progress",
};

export function formatSyncFailureMessage(reasonOrError) {
  if (!reasonOrError) return "Sync failed";
  if (typeof reasonOrError === "string") {
    if (SYNC_REASON_HI[reasonOrError]) {
      return `${SYNC_REASON_HI[reasonOrError]} / ${SYNC_REASON_EN[reasonOrError]}`;
    }
    return reasonOrError;
  }
  return reasonOrError.message || "Sync failed";
}
