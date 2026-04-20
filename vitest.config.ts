import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/__tests__/**",
        "src/scaffolder/templates/**",
        "src/scaffolder/hooks/**",
        "src/cli.ts",
        "src/commands/**",
        // Orchestrator modules that spawn external processes or call external APIs —
        // pure functions in these files are tested but the full command flow requires
        // mocking process spawning or HTTP which is out of unit-test scope.
        "src/auto/index.ts",
        "src/linear/client.ts",
        "src/config/integrations.ts",
      ],
      thresholds: {
        lines: 80,
        branches: 75,
      },
    },
  },
});
