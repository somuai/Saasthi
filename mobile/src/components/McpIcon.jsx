import * as React from "react";
import Svg, { Circle, Path } from "react-native-svg";

const DEFAULT_SIZE = 22;
const DEFAULT_COLOR = "#6B6B6B";

export function McpIcon({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Head with hair bun */}
      <Circle cx={12} cy={5} r={2.5} fill={color} />
      <Circle cx={11} cy={3.5} r={1.2} fill={color} opacity={0.7} />
      {/* Neck */}
      <Path d="M11.3 7.5h1.4v1h-1.4z" fill={color} />
      {/* Saree blouse + torso */}
      <Path d="M8 10.5c0-1.2.9-2 2-2h4c1.1 0 2 .8 2 2v1c0 1.8-1.8 4.5-4 4.5s-4-2.7-4-4.5v-1z" fill={color} />
      {/* Pregnant belly curve */}
      <Path d="M8.5 11.5c0 1.5 1.6 5 3.5 5s3.5-3.5 3.5-5" fill="none" stroke={color} strokeWidth={0.5} opacity={0.6} />
      {/* Saree pallu over left shoulder */}
      <Path d="M10.5 8.8c0-.5.4-.8.8-.8h1.4c.4 0 .8.3.8.8l-.4 2.5a1 1 0 0 1-1.1.8c-.6 0-1-.5-.9-1l.4-2.3z" fill={color} opacity={0.7} />
    </Svg>
  );
}
