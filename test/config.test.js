import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

test("live mode requires an API key", () => {
  assert.throws(
    () => loadConfig({ MEMENTO_MOCK_MODE: "false" }),
    (error) => error.code === "CONFIG_MISSING"
  );
});

test("mock mode starts without an API key and uses the confirmed models", () => {
  const config = loadConfig({ MEMENTO_MOCK_MODE: "true", PORT: "3100" });
  assert.equal(config.mockMode, true);
  assert.equal(config.textModel, "glm-4.7-flash");
  assert.equal(config.visionModel, "glm-4.6v-flash");
  assert.equal(config.port, 3100);
});
