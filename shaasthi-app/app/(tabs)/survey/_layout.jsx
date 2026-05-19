import { Stack } from "expo-router";
import { COLORS } from "../../../src/constants/colors";

export default function SurveyLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    />
  );
}
