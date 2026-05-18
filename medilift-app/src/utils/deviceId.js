import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const DEVICE_ID_KEY = "medilift_device_id";

export async function getDeviceId() {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}
