import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { getDatabase } from "../database/getDatabase";

/* global WebSocket */

const BACKGROUND_LOCATION_TASK = "background-location-task";

// Battery-conscious tracking presets
export const TrackingModes = {
  HIGH_ACCURACY: {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 10, // meters
    deferredUpdatesInterval: 5000, // 5 seconds
    showsBackgroundLocationIndicator: true,
  },
  BALANCED: {
    accuracy: Location.Accuracy.High,
    distanceInterval: 50,
    deferredUpdatesInterval: 30000,
  },
  BATTERY_SAVING: {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 200,
    deferredUpdatesInterval: 120000, // 2 mins
  },
};

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error("Background Location Task Error:", error);
    return;
  }
  if (data) {
    const { locations } = data;
    if (!locations || locations.length === 0) return;

    try {
      const db = getDatabase();
      await db.write(async () => {
        for (const loc of locations) {
          await db.get("location_logs").create((record) => {
            record.latitude = loc.coords.latitude;
            record.longitude = loc.coords.longitude;
            record.accuracy = loc.coords.accuracy;
            record.altitude = loc.coords.altitude;
            record.speed = loc.coords.speed;
            // record.batteryPct = ? (can fetch via expo-battery if needed, omitting for now)
            record.recordedAt = new Date(loc.timestamp).toISOString();
            record.isSynced = false;
            // The sync engine will upload isSynced=false records
          });
        }
      });
    } catch (e) {
      console.error("Failed to save background location to WatermelonDB", e);
    }
  }
});

class LocationService {
  constructor() {
    this.foregroundSub = null;
    this.ws = null;
  }

  async requestPermissions() {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== "granted") return false;
    
    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === "granted";
  }

  async startBackgroundTracking(mode = TrackingModes.BALANCED) {
    const hasPerm = await this.requestPermissions();
    if (!hasPerm) return;

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (!isRegistered) {
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, mode);
    }
  }

  async stopBackgroundTracking() {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  }

  async startForegroundStreaming(wsUrl, token) {
    const hasPerm = await this.requestPermissions();
    if (!hasPerm) return;

    this.ws = new WebSocket(`${wsUrl}?token=${token}`);
    
    this.foregroundSub = await Location.watchPositionAsync(
      TrackingModes.HIGH_ACCURACY,
      (location) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            accuracy: location.coords.accuracy,
            timestamp: location.timestamp
          }));
        }
      }
    );
  }

  stopForegroundStreaming() {
    if (this.foregroundSub) {
      this.foregroundSub.remove();
      this.foregroundSub = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const locationService = new LocationService();
