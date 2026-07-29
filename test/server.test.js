import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { bootstrap } from "../src/server.js";

const quietLogger = { info() {}, error() {} };

test("mock server serves the prototype and reports model configuration", async (t) => {
  const { config, server } = await bootstrap(
    { MEMENTO_MOCK_MODE: "true", PORT: "3000" },
    quietLogger
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${origin}/api/health`).then((response) =>
    response.json()
  );
  assert.deepEqual(health, {
    ok: true,
    mode: "mock",
    text_model: "glm-4.7-flash",
    vision_model: "glm-4.6v-flash"
  });

  const htmlResponse = await fetch(origin);
  const html = await htmlResponse.text();
  assert.equal(htmlResponse.status, 200);
  assert.match(html, /Memento 记忆编辑器/);
  assert.equal(htmlResponse.headers.get("x-frame-options"), "DENY");

  const result = await fetch(`${origin}/api/memento`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contract_version: "1.1",
      mode: "auto",
      raw_text: "这是男朋友告白那天送的花。"
    })
  }).then((response) => response.json());
  assert.equal(result.mode, "ask_followup");
  assert.ok(result.request_id);
  assert.equal(config.apiKey, "");
});

test("public files contain no upstream endpoint, bearer token, or secret key name", async () => {
  const projectRoot = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    ".."
  );
  const files = ["index.html", "styles.css", "app.js"];
  const contents = await Promise.all(
    files.map((file) => readFile(path.join(projectRoot, "public", file), "utf8"))
  );
  const joined = contents.join("\n");
  assert.doesNotMatch(joined, /open\.bigmodel\.cn/);
  assert.doesNotMatch(joined, /BIGMODEL_API_KEY/);
  assert.doesNotMatch(joined, /Bearer\s+/);
});
