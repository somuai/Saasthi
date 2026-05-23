import { Platform } from "react-native";
import { apiUrl } from "../constants/api";
import { getAccessToken } from "./auth";

let messaging = null;
try {
  messaging = require("@react-native-firebase/messaging").default;
} catch (_) {}

export async function requestNotificationPermission() {
  if (!messaging) return false;
  try {
    const authStatus = await messaging().requestPermission();
    return authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}

export async function getFcmToken() {
  if (!messaging) return null;
  try {
    return await messaging().getToken();
  } catch {
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
  } catch (_) {}
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
