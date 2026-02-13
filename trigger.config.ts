import { defineConfig } from "@trigger.dev/sdk/v3";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
  project: "proj_gwelfqscrhdgtzzmqgxk",
  runtime: "node",
  logLevel: "log",
  maxDuration: 7200, // 2 hours — enough for 100+ page documents at ~60s/page (Opus 600s timeout)
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
