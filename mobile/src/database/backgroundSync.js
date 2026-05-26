import { logger } from "../utils/logger";

const TASK_NAME = "shaasthi-background-sync";

let taskDefined = false;

/** Register periodic background sync when expo-background-fetch is available. */
export async function registerBackgroundSync() {
  try {
    const BackgroundFetch = require("expo-background-fetch");
    const TaskManager = require("expo-task-manager");

    if (!taskDefined) {
      TaskManager.defineTask(TASK_NAME, async () => {
        try {
          const { syncWithServer } = await import("./sync");
          const result = await syncWithServer();
          return result.success ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
        } catch (e) {
          logger.warn("Background sync task failed", e?.message);
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
      });
      taskDefined = true;
    }

    const status = await BackgroundFetch.getStatusAsync();
    if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) return false;

    await BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: 60 * 15,
      stopOnTerminate: false,
      startOnBoot: true,
    });
    return true;
  } catch (e) {
    logger.warn("Background sync registration failed", e?.message);
    return false;
  }
}
