import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { AppProvider } from "../src/store/AppProvider";
import { COLORS } from "../src/constants/colors";

function AuthGuard({ children }) {
  const user = useSelector((s) => s.auth.user);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuth = segments[0] === "(auth)";
    if (!user && !inAuth) {
      router.replace("/(auth)/login");
    } else if (user && inAuth) {
      router.replace("/(tabs)/home");
    }
  }, [user, segments, router]);

  return children;
}

export default function RootLayout() {
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
