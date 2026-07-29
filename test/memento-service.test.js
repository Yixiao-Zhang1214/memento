import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { loadConfig } from "../src/config.js";
import { MementoService } from "../src/memento-service.js";
import { MockModelClient } from "../src/mock-model-client.js";
import { PromptLoader } from "../src/prompt-loader.js";

const execFileAsync = promisify(execFile);

async function createService() {
  const config = loadConfig({ MEMENTO_MOCK_MODE: "true" });
  const promptLoader = await new PromptLoader(config.skillDirectory).initialize();
  const calls = [];
  const inner = new MockModelClient();
  const modelClient = {
    async complete(request) {
      calls.push(request);
      return inner.complete(request);
    }
  };
  const service = new MementoService({
    config,
    modelClient,
    promptLoader,
    logger: { info() {}, error() {} }
  });
  return { service, calls };
}

test("a fresh complete confession still receives exactly one follow-up", async () => {
  const { service, calls } = await createService();
  const result = await service.process(
    {
      contract_version: "1.1",
      mode: "auto",
      raw_text:
        "这是男朋友告白那天送的花。他问我愿不愿意做他女朋友，我说好，我们就这么在一起了。",
      question_state: {
        asked: false,
        replaced: false,
        answered: false,
        closed: false
      }
    },
    "test-request"
  );

  assert.equal(result.mode, "ask_followup");
  assert.equal(result.question, "他说完那句话以后，你们做了什么？");
  assert.deepEqual(
    result.user_actions.map((action) => action.id),
    ["replace_question", "compose_now"]
  );
  assert.equal(calls.filter((call) => call.purpose === "follow_up").length, 1);
});

test("image evidence is extracted once and reused by text generation", async () => {
  const { service, calls } = await createService();
  const result = await service.process(
    {
      contract_version: "1.1",
      mode: "auto",
      raw_text: "一张准备留下的照片。",
      image: {
        mime_type: "image/jpeg",
        data_base64: "YWJj"
      },
      visual_evidence: []
    },
    "test-request"
  );

  assert.equal(result.mode, "ask_followup");
  assert.equal(
    calls.filter((call) => call.purpose.startsWith("vision")).length,
    1
  );
  const visionCall = calls.find((call) => call.purpose === "vision");
  assert.equal(
    visionCall.messages[0].content[0].image_url.url,
    "YWJj",
    "智谱视觉接口接收原始 Base64，不添加 data URL 前缀"
  );
  assert.ok(result.evidence.some((item) => item.level === "E2"));
});

test("question replacement removes the second replacement action", async () => {
  const { service } = await createService();
  const result = await service.process(
    {
      contract_version: "1.1",
      mode: "ask_followup",
      raw_text: "这是我用了六年的手机。",
      question_state: {
        asked: true,
        replaced: true,
        answered: false,
        closed: false,
        previous_intent: "contrast_probe"
      }
    },
    "test-request"
  );

  assert.deepEqual(result.user_actions, [
    { id: "compose_now", label: "就这样收藏" }
  ]);
});

test("answering the follow-up generates the base polished draft", async () => {
  const { service } = await createService();
  const result = await service.process(
    {
      contract_version: "1.1",
      mode: "compose_memory",
      raw_text:
        "这是男朋友告白那天送的花。他问我愿不愿意做我女朋友，我说好。",
      follow_up_question: "他说完那句话以后，你们做了什么？",
      follow_up_answer: "他抱了抱我",
      question_state: {
        asked: true,
        replaced: false,
        answered: true,
        closed: true
      }
    },
    "test-request"
  );

  assert.equal(result.mode, "compose_memory");
  assert.equal(result.draft_stage, "base_polished");
  assert.match(result.story_text, /他抱了抱我/);
  assert.equal(result.source_line, "他的一句“愿不愿意”");
  assert.equal(result.post_draft_actions.length, 3);
});

test("style rewrite changes only the body and preserves editorial fields", async () => {
  const { service } = await createService();
  const base = await service.process(
    {
      contract_version: "1.1",
      mode: "compose_memory",
      raw_text: "这是我用了六年的手机，64G内存不够了。",
      user_skipped: true,
      question_state: {
        asked: true,
        replaced: false,
        answered: false,
        closed: true
      }
    },
    "test-request"
  );
  const restyled = await service.process(
    {
      contract_version: "1.1",
      mode: "rewrite_text",
      raw_text: "这是我用了六年的手机，64G内存不够了。",
      current_draft: base,
      style: "private_label",
      draft_state: {
        base_draft_generated: true,
        revision_state: "in_progress",
        selected_preset: "private_label",
        custom_style_request: null
      }
    },
    "test-request"
  );

  assert.equal(restyled.draft_stage, "restyled");
  assert.match(restyled.story_text, /^藏品记录：/);
  assert.equal(restyled.title, base.title);
  assert.equal(restyled.source_line, base.source_line);
  assert.equal(restyled.curator_note, base.curator_note);
});

test("composed mock output passes the Skill contract validator", async () => {
  const { service } = await createService();
  const result = await service.process(
    {
      contract_version: "1.1",
      mode: "compose_memory",
      raw_text:
        "这是男朋友告白那天送的花。他问我愿不愿意做我女朋友，我说好。",
      follow_up_answer: "他抱了抱我",
      question_state: {
        asked: true,
        replaced: false,
        answered: true,
        closed: true
      }
    },
    "test-request"
  );
  const directory = await mkdtemp(path.join(tmpdir(), "memento-contract-"));
  const fixturePath = path.join(directory, "output.json");
  await writeFile(fixturePath, JSON.stringify(result), "utf8");

  try {
    const validator = path.resolve(
      "skills/memento-memory-editor/scripts/validate_output.py"
    );
    const { stdout } = await execFileAsync("python3", [validator, fixturePath]);
    assert.match(stdout, /valid/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
