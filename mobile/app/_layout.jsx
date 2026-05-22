import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { useShaasthiFonts } from "../src/hooks/useShaasthiFonts";
import { StatusBar } from "expo-status-bar";
import { useSelector } from "react-redux";
import { AppProvider } from "../src/store/AppProvider";
import { COLORS } from "../src/constants/colors";
import { isWatermelonNativeAvailable } from "../src/database/isNativeAvailable";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { SplashScreen } from "../src/components/SplashScreen";
import { UpdateRequiredScreen } from "../src/components/UpdateRequiredScreen";
import { useAppVersion } from "../src/hooks/useAppVersion";

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
  const [fontsLoaded] = useShaasthiFonts();
  const { loading: versionLoading, blocked, updateUrl } = useAppVersion();

  if (!fontsLoaded || versionLoading) {
    return <SplashScreen />;
  }

  if (blocked) {
    return <UpdateRequiredScreen updateUrl={updateUrl} />;
  }

  return (
    <AppProvider>
      <ErrorBoundary>
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
      </ErrorBoundary>
    </AppProvider>
  );
}
