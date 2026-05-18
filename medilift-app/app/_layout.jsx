import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { useMediliftFonts } from "../src/hooks/useMediliftFonts";
import { StatusBar } from "expo-status-bar";
import { useSelector } from "react-redux";
import { AppProvider } from "../src/store/AppProvider";
import { COLORS } from "../src/constants/colors";
import { isWatermelonNativeAvailable } from "../src/database/isNativeAvailable";

function AuthGuard({ children }) {
  const user = useSelector((s) => s.auth.user);
  const segments = useSegments();
  const router = useRouter();
  const nativeDb = isWatermelonNativeAvailable();

  useEffect(() => {
    const inAuth = segments[0] === "(auth)";
    const authScreen = segments[1];
    const onSplash = authScreen === "splash";
    const onNativeRequired = authScreen === "native-required";

    if (__DEV__) {
      console.log("[AuthGuard]", { user: !!user, inAuth, authScreen, nativeDb });
    }

    // ── Unauthenticated: always allow auth screens ──
    if (!user) {
      if (!inAuth) {
        router.replace("/(auth)/splash");
      } else if (!onSplash && authScreen !== "login" && authScreen !== "otp") {
        router.replace("/(auth)/login");
      }
      // Otherwise stay on the current auth screen (login / otp / splash)
      return;
    }

    // ── Authenticated: route to app or native-required ──
    if (inAuth && !onSplash && !onNativeRequired) {
      if (nativeDb) {
        router.replace("/(tabs)/home");
      } else {
        router.replace("/(auth)/native-required");
      }
    }
    if (!inAuth && !nativeDb) {
      router.replace("/(auth)/native-required");
    }
  }, [user, segments, router, nativeDb]);

  return children;
}

export default function RootLayout() {
  const [fontsLoaded] = useMediliftFonts();

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AppProvider>
      <AuthGuard>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthGuard>
    </AppProvider>
  );
}

