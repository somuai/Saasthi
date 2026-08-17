import { Platform } from "react-native";

import { logger } from "../utils/logger";

const PNV_MODULE_NAME = "@react-native-firebase/phone-number-verification";
const enabledEnv = String(process.env.EXPO_PUBLIC_FIREBASE_PNV_ENABLED || "").toLowerCase();
const testToken = process.env.EXPO_PUBLIC_FIREBASE_PNV_TEST_TOKEN || "";

export function isFirebasePnvEnabled() {
  return Platform.OS === "android" && ["1", "true", "yes"].includes(enabledEnv);
}

function loadFirebasePnvModule() {
  try {
    return require(PNV_MODULE_NAME);
  } catch (error) {
    logger.debug("Firebase PNV native module not installed", error?.message);
    return null;
  }
}

export async function getFirebasePnvSupportInfo() {
  if (!isFirebasePnvEnabled()) return [];
  const pnv = loadFirebasePnvModule();
  if (!pnv?.getVerificationSupportInfo) return [];
  return pnv.getVerificationSupportInfo();
}

export async function tryFirebasePnvVerification() {
  if (!isFirebasePnvEnabled()) {
    return { status: "disabled" };
  }

  const pnv = loadFirebasePnvModule();
  if (!pnv?.getVerifiedPhoneNumber || !pnv?.getVerificationSupportInfo) {
    return { status: "module_unavailable" };
  }

  if (testToken && pnv.enableTestSession) {
    try {
      await pnv.enableTestSession(testToken);
    } catch (error) {
      if (error?.code !== "pnv/test-session-already-enabled") {
        throw error;
      }
    }
  }

  const supportInfo = await pnv.getVerificationSupportInfo();
  const supported = supportInfo.some((slot) => slot?.isSupported);
  if (!supported) {
    return { status: "unsupported", supportInfo };
  }

  const result = await pnv.getVerifiedPhoneNumber();
  if (!result?.token || !result?.phoneNumber) {
    return { status: "empty_result", supportInfo };
  }

  return {
    status: "verified",
    phoneNumber: result.phoneNumber,
    token: result.token,
    expiresAt: result.expirationTimestamp,
    supportInfo,
  };
}
