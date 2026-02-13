import { defineConfig } from "@trigger.dev/sdk/v3";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
  project: "proj_gwelfqscrhdgtzzmqgxk",
  runtime: "node",
  logLevel: "log",
  maxDuration: 3600, // 1 hour — enough for 50+ page documents at ~60s/page
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
  build: {
    extensions: [
      prismaExtension({ mode: "legacy", schema: "prisma/schema.prisma", version: "6.7.0", migrate: false }),
    ],
  },
});
