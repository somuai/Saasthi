import { Platform } from "react-native";
import { apiUrl } from "../constants/api";
import { getAccessToken } from "./auth";
import { logger } from "../utils/logger";

let messaging = null;
try {
  messaging = require("@react-native-firebase/messaging").default;
} catch (e) {
  logger.warn("Firebase messaging not available", e?.message);
}

export async function requestNotificationPermission() {
  if (!messaging) return false;
  try {
    const authStatus = await messaging().requestPermission();
    return authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  } catch (e) {
    logger.warn("Notification permission request failed", e?.message);
    return false;
  }
}

export async function getFcmToken() {
  if (!messaging) return null;
  try {
    return await messaging().getToken();
  } catch (e) {
    logger.warn("Failed to get FCM token", e?.message);
    return null;
  }
}

export async function registerFcmTokenOnServer() {
  if (Platform.OS === "web") return;
  const token = await getFcmToken();
  if (!token) return;
  const accessToken = await getAccessToken();
  if (!accessToken) return;
  try {
    await fetch(apiUrl("/auth/users/fcm-token/"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ fcm_token: token }),
    });
  } catch (e) {
    logger.warn("Failed to register FCM token on server", e?.message);
  }
}

export function onMessageListener(callback) {
  if (!messaging) return () => {};
  const unsubscribe = messaging().onMessage(callback);
  return unsubscribe;
}

export async function registerBackgroundHandler() {
  if (!messaging) return;
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log("Background message:", remoteMessage);
  });
}
