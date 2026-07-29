import test from "node:test";
import assert from "node:assert/strict";
import { BigModelClient } from "../src/bigmodel-client.js";

test("BigModel client sends the key only in the upstream authorization header", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return new Response(
      JSON.stringify({
        id: "upstream-id",
        choices: [{ message: { content: "{\"ok\":true}" } }]
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };
  const client = new BigModelClient({
    apiKey: "test-secret-key",
    baseUrl: "https://example.invalid/api/paas/v4",
    fetchImpl
  });

  const result = await client.complete({
    model: "glm-4.7-flash",
    messages: [{ role: "user", content: "test" }],
    thinking: { type: "enabled" },
    temperature: 0.7,
    maxTokens: 4096,
    responseFormat: { type: "json_object" }
  });

  assert.equal(result.content, "{\"ok\":true}");
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].url,
    "https://example.invalid/api/paas/v4/chat/completions"
  );
  assert.equal(
    requests[0].options.headers.Authorization,
    "Bearer test-secret-key"
  );
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.model, "glm-4.7-flash");
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.equal(requests[0].options.body.includes("test-secret-key"), false);
});

test("BigModel client retries a rate limit once", async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    if (attempts === 1) {
      return new Response("rate limited", { status: 429 });
    }
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "{\"ok\":true}" } }]
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };
  const client = new BigModelClient({
    apiKey: "test-key",
    baseUrl: "https://example.invalid",
    fetchImpl
  });

  await client.complete({
    model: "glm-4.7-flash",
    messages: [],
    thinking: { type: "enabled" },
    temperature: 0.7,
    maxTokens: 10
  });

  assert.equal(attempts, 2);
});
