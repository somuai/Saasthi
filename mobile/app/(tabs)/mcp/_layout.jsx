import { Stack } from "expo-router";
import { COLORS } from "../../../src/constants/colors";

export default function McpLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    />
  );
}
