import { useState, useEffect } from "react";
import { apiClient } from "../api/client";
import { endpoints } from "../constants/api";
import Constants from "expo-constants";

const APP_VERSION = Constants.expoConfig?.version || "1.0.0";

export function useAppVersion() {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get(endpoints.appVersion);
        if (cancelled) return;
        if (data.force_update && compareVersions(APP_VERSION, data.min_version) < 0) {
          setBlocked(true);
        }
      } catch {
        // API not reachable — allow offline usage
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { loading, blocked, updateUrl: null, appVersion: APP_VERSION };
}

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff) return diff;
  }
  return 0;
}
