// filepath: c:\mount\dev\git\node-builder\vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "jsdom",
		setupFiles: ["./tests/setupTests.ts"],
	},
});
