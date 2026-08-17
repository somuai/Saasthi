import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
};

export default withSentryConfig(withSerwist(nextConfig), {
  silent: true,
  org: "enactus-kiit",
  project: "shaasthi-dashboard",
  widenClientFileUpload: true,
  sourcemaps: { disable: true },
  disableLogger: true,
});
