import LottieView from "lottie-react-native";
import { useEffect, useRef } from "react";

const ANIMATIONS = {
  survey_success: require("../../assets/animations/survey_success.json"),
  syncing: require("../../assets/animations/syncing.json"),
  sync_complete: require("../../assets/animations/sync_complete.json"),
  ai_thinking: require("../../assets/animations/ai_thinking.json"),
  visit_complete: require("../../assets/animations/visit_complete.json"),
  incentive_earned: require("../../assets/animations/incentive_earned.json"),
  empty_households: require("../../assets/animations/empty_households.json"),
  fic_complete: require("../../assets/animations/fic_complete.json"),
};

export function LottieWrapper({ name, size = 120, loop = false, autoPlay = true, onFinish, speed = 1, style }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && autoPlay) {
      ref.current.play();
    }
  }, [name, autoPlay]);

  return (
    <LottieView
      ref={ref}
      source={ANIMATIONS[name]}
      style={[{ width: size, height: size }, style]}
      loop={loop}
      autoPlay={autoPlay}
      speed={speed}
      onAnimationFinish={onFinish}
    />
  );
}
