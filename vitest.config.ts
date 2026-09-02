import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    maxWorkers: 1,
    minWorkers: 1,
    setupFiles: ["./tests/setup.ts"],
  },
});
