import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { AppError } from "../src/errors.js";
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

test("a busy primary text model falls back without blocking the memory flow", async () => {
  const config = loadConfig({ MEMENTO_MOCK_MODE: "true" });
  const promptLoader = await new PromptLoader(config.skillDirectory).initialize();
  const calls = [];
  const inner = new MockModelClient();
  const modelClient = {
    async complete(request) {
      calls.push(request);
      if (request.model === config.textModel) {
        throw new AppError({
          code: "UPSTREAM_RATE_LIMITED",
          message: "busy",
          status: 503,
          retryable: true
        });
      }
      return inner.complete(request);
    }
  };
  const service = new MementoService({
    config,
    modelClient,
    promptLoader,
    logger: { info() {}, warn() {}, error() {} }
  });

  const result = await service.process(
    {
      contract_version: "1.1",
      mode: "auto",
      raw_text: "这是我用了六年的手机，只有64G，现在内存不够了。"
    },
    "fallback-test"
  );

  assert.deepEqual(
    calls.map((call) => call.model),
    [config.textModel, config.textFallbackModel]
  );
  assert.equal(calls[0].maxAttempts, 1);
  assert.equal(calls[0].timeoutMs, 15_000);
  assert.equal(result.mode, "ask_followup");
  assert.deepEqual(result.runtime, {
    model_used: config.textFallbackModel,
    fallback_used: true
  });
});

test("two rate-limited text models still return a local follow-up", async () => {
  const config = loadConfig({ MEMENTO_MOCK_MODE: "true" });
  const promptLoader = await new PromptLoader(config.skillDirectory).initialize();
  const calls = [];
  const service = new MementoService({
    config,
    modelClient: {
      async complete(request) {
        calls.push(request);
        throw new AppError({
          code: "UPSTREAM_RATE_LIMITED",
          message: "busy",
          status: 503,
          retryable: true
        });
      }
    },
    promptLoader,
    logger: { info() {}, warn() {}, error() {} }
  });

  const result = await service.process(
    {
      contract_version: "1.1",
      mode: "auto",
      raw_text: "这是我用了六年的手机，只有64G，现在内存不够了。"
    },
    "double-rate-limit-test"
  );

  assert.deepEqual(
    calls.map((call) => call.model),
    [config.textModel, config.textFallbackModel]
  );
  assert.ok(calls.every((call) => call.maxAttempts === 1));
  assert.equal(result.mode, "ask_followup");
  assert.equal(result.question, "用了这么久，你最舍不得它的是什么？");
  assert.equal(result.runtime.model_used, "local-editorial-fallback");

  const secondResult = await service.process(
    {
      contract_version: "1.1",
      mode: "auto",
      raw_text: "这是我用了六年的手机，只有64G，现在内存不够了。"
    },
    "double-rate-limit-test-2"
  );
  assert.equal(calls.length, 2, "熔断期间不再请求两个故障模型");
  assert.equal(
    secondResult.runtime.model_used,
    "local-editorial-fallback"
  );
});

test("two repetitive model questions recover to a safe local question", async () => {
  const config = loadConfig({ MEMENTO_MOCK_MODE: "true" });
  const promptLoader = await new PromptLoader(config.skillDirectory).initialize();
  let calls = 0;
  const invalidQuestion = {
    contract_version: "1.1",
    status: "needs_user_input",
    mode: "ask_followup",
    needs_followup: true,
    question_intent: "significance_probe",
    question: "是什么让你决定换掉这部手机的？",
    user_actions: [
      { id: "replace_question", label: "换一个问题" },
      { id: "compose_now", label: "就这样收藏" }
    ]
  };
  const service = new MementoService({
    config,
    modelClient: {
      async complete() {
        calls += 1;
        return {
          content: JSON.stringify(invalidQuestion),
          upstreamRequestId: "bad-question",
          usage: null
        };
      }
    },
    promptLoader,
    logger: { info() {}, warn() {}, error() {} }
  });

  const result = await service.process(
    {
      contract_version: "1.1",
      mode: "auto",
      raw_text:
        "这是我用了6年的手机，我没办法继续使用了，因为内存不够。"
    },
    "safe-question-test"
  );

  assert.equal(calls, 2);
  assert.equal(result.question, "用了这么久，你最舍不得它的是什么？");
  assert.equal(result.decision_code, "SAFE_QUESTION_FALLBACK");
  assert.equal(result.runtime.model_used, "local-editorial-fallback");
});

test("two invented model years recover to an evidence-bound local draft", async () => {
  const config = loadConfig({ MEMENTO_MOCK_MODE: "true" });
  const promptLoader = await new PromptLoader(config.skillDirectory).initialize();
  const inner = new MockModelClient();
  let calls = 0;
  const service = new MementoService({
    config,
    modelClient: {
      async complete(request) {
        calls += 1;
        const response = await inner.complete(request);
        const output = JSON.parse(response.content);
        output.source_line = "2023年，一部64G手机";
        return { ...response, content: JSON.stringify(output) };
      }
    },
    promptLoader,
    logger: { info() {}, warn() {}, error() {} }
  });

  const result = await service.process(
    {
      contract_version: "1.1",
      mode: "compose_memory",
      raw_text:
        "这是我用了6年的手机，只有64G，现在因为内存不够没办法继续用了。",
      follow_up_answer: "它其实一直很好用。",
      question_state: {
        asked: true,
        replaced: false,
        answered: true,
        closed: true
      }
    },
    "safe-draft-test"
  );

  assert.equal(calls, 2);
  assert.equal(result.title, "64G的六年");
  assert.equal(result.source_line, "我和它的六年");
  assert.doesNotMatch(JSON.stringify(result), /2023年/);
  assert.equal(result.runtime.model_used, "local-editorial-fallback");
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

test("rate-limited vision continues with safe upload metadata", async () => {
  const config = loadConfig({ MEMENTO_MOCK_MODE: "true" });
  const promptLoader = await new PromptLoader(config.skillDirectory).initialize();
  const calls = [];
  const inner = new MockModelClient();
  const service = new MementoService({
    config,
    modelClient: {
      async complete(request) {
        calls.push(request);
        if (request.purpose.startsWith("vision")) {
          throw new AppError({
            code: "UPSTREAM_RATE_LIMITED",
            message: "busy",
            status: 503,
            retryable: true
          });
        }
        return inner.complete(request);
      }
    },
    promptLoader,
    logger: { info() {}, warn() {}, error() {} }
  });

  const result = await service.process(
    {
      contract_version: "1.1",
      mode: "auto",
      raw_text: "",
      image: {
        mime_type: "image/jpeg",
        data_base64: "YWJj"
      },
      visual_evidence: []
    },
    "vision-rate-limit-test"
  );

  const visionCall = calls.find((call) => call.purpose === "vision");
  assert.equal(visionCall.maxAttempts, 1);
  assert.equal(visionCall.timeoutMs, 15_000);
  assert.equal(result.mode, "ask_followup");
  assert.ok(
    result.evidence.some(
      (item) =>
        item.level === "E2" && item.content === "用户上传了一张图片"
    )
  );

  await service.process(
    {
      contract_version: "1.1",
      mode: "auto",
      raw_text: "",
      image: {
        mime_type: "image/jpeg",
        data_base64: "YWJj"
      },
      visual_evidence: []
    },
    "vision-rate-limit-test-2"
  );
  assert.equal(
    calls.filter((call) => call.purpose.startsWith("vision")).length,
    1,
    "视觉模型熔断期间不再重复请求"
  );
});

test("image-only memory can still compose when every model is rate-limited", async () => {
  const config = loadConfig({ MEMENTO_MOCK_MODE: "true" });
  const promptLoader = await new PromptLoader(config.skillDirectory).initialize();
  const service = new MementoService({
    config,
    modelClient: {
      async complete() {
        throw new AppError({
          code: "UPSTREAM_RATE_LIMITED",
          message: "busy",
          status: 503,
          retryable: true
        });
      }
    },
    promptLoader,
    logger: { info() {}, warn() {}, error() {} }
  });

  const result = await service.process(
    {
      contract_version: "1.1",
      mode: "compose_memory",
      raw_text: "",
      visual_evidence: ["用户上传了一张图片"],
      user_skipped: true,
      question_state: {
        asked: true,
        replaced: false,
        answered: false,
        closed: true
      }
    },
    "image-only-compose-test"
  );

  assert.equal(result.mode, "compose_memory");
  assert.equal(result.text_type, "quiet");
  assert.match(result.story_text, /用户上传了一张图片/);
  assert.equal(result.runtime.model_used, "local-editorial-fallback");
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
  assert.deepEqual(
    result.post_draft_actions.map((action) => action.id),
    [
      "continue_supplement",
      "ask_more",
      "keep_draft",
      "adjust_style",
      "custom_style"
    ]
  );
});

test("recurring composition keeps every user contribution but not assistant questions", async () => {
  const { service } = await createService();
  const result = await service.process(
    {
      contract_version: "1.1",
      mode: "compose_memory",
      raw_text: "这是我用了六年的手机。",
      conversation_history: [
        {
          id: "entry-1",
          round: 0,
          role: "user",
          kind: "initial",
          content: "这是我用了六年的手机，只有64G。"
        },
        {
          id: "entry-2",
          round: 0,
          role: "assistant",
          kind: "question",
          content: "用了这么久，你最舍不得它的是什么？"
        },
        {
          id: "entry-3",
          round: 0,
          role: "user",
          kind: "answer",
          content: "它一直很好用，只是我总在清内存。"
        },
        {
          id: "entry-4",
          round: 1,
          role: "user",
          kind: "supplement",
          content: "如果一加还出直面屏，我可能就不会换苹果。"
        },
        {
          id: "entry-5",
          round: 1,
          role: "assistant",
          kind: "question",
          content: "除了内存，它最好用的地方是什么？"
        },
        {
          id: "entry-6",
          round: 1,
          role: "user",
          kind: "answer",
          content: "系统很顺手，握在手里也舒服。"
        }
      ],
      conversation_round: {
        index: 1,
        trigger: "supplement",
        asked: true,
        replaced: false,
        answered: true,
        closed: true
      },
      question_state: {
        asked: true,
        replaced: false,
        answered: true,
        closed: true
      }
    },
    "recurring-compose-test"
  );

  assert.match(result.story_text, /只有64G/);
  assert.match(result.story_text, /总在清内存/);
  assert.match(result.story_text, /不会换苹果/);
  assert.match(result.story_text, /握在手里也舒服/);
  assert.doesNotMatch(result.story_text, /最舍不得它的是什么/);
  assert.doesNotMatch(result.story_text, /最好用的地方是什么/);
  assert.equal(
    result.evidence.filter((item) => item.level === "E1").length,
    4
  );
});

test("ask-more avoids a question already present in conversation history", async () => {
  const { service, calls } = await createService();
  const result = await service.process(
    {
      contract_version: "1.1",
      mode: "ask_followup",
      raw_text: "这是我用了六年的手机，只有64G。",
      conversation_history: [
        {
          id: "entry-1",
          round: 0,
          role: "user",
          kind: "initial",
          content: "这是我用了六年的手机，只有64G。"
        },
        {
          id: "entry-2",
          round: 0,
          role: "assistant",
          kind: "question",
          content: "用了这么久，你最舍不得它的是什么？"
        },
        {
          id: "entry-3",
          round: 0,
          role: "user",
          kind: "answer",
          content: "总是在清内存，但它确实很好用。"
        }
      ],
      conversation_round: {
        index: 1,
        trigger: "ask_more",
        asked: false,
        replaced: false,
        answered: false,
        closed: false
      },
      question_state: {
        asked: false,
        replaced: false,
        answered: false,
        closed: false
      }
    },
    "ask-more-dedupe-test"
  );

  assert.notEqual(
    result.question,
    "用了这么久，你最舍不得它的是什么？"
  );
  assert.equal(
    result.question,
    "这六年里，它有没有陪你经历一件一直记得的事？"
  );
  assert.equal(
    calls.filter((call) => call.purpose.startsWith("follow_up")).length,
    2
  );
});

test("local fallback follows the current supplement before the broad object topic", async () => {
  const config = loadConfig({ MEMENTO_MOCK_MODE: "true" });
  const promptLoader = await new PromptLoader(config.skillDirectory).initialize();
  const service = new MementoService({
    config,
    modelClient: {
      async complete() {
        throw new AppError({
          code: "UPSTREAM_UNAVAILABLE",
          message: "offline",
          status: 503,
          retryable: true
        });
      }
    },
    promptLoader,
    logger: { info() {}, warn() {}, error() {} }
  });

  const result = await service.process(
    {
      contract_version: "1.1",
      mode: "ask_followup",
      raw_text: "这是我用了六年的手机，只有64G。",
      conversation_history: [
        {
          id: "entry-1",
          round: 0,
          role: "user",
          kind: "initial",
          content: "这是我用了六年的手机，只有64G。"
        },
        {
          id: "entry-2",
          round: 1,
          role: "user",
          kind: "supplement",
          content: "大学毕业时，我用它拍了最后一张宿舍合照。"
        }
      ],
      conversation_round: {
        index: 1,
        trigger: "supplement",
        asked: false,
        replaced: false,
        answered: false,
        closed: false
      },
      question_state: {
        asked: false,
        replaced: false,
        answered: false,
        closed: false
      }
    },
    "supplement-first-fallback-test"
  );

  assert.equal(
    result.question,
    "拍下那张照片时，有没有一句话或一个动作你还记得？"
  );
});

test("ten user-opened rounds remain available to the final composition", async () => {
  const { service } = await createService();
  const conversationHistory = Array.from({ length: 10 }, (_, index) => ({
    id: `entry-${index + 1}`,
    round: index,
    role: "user",
    kind: index === 0 ? "initial" : "supplement",
    content: `第${index + 1}段记忆细节`
  }));

  const result = await service.process(
    {
      contract_version: "1.1",
      mode: "compose_memory",
      raw_text: "第1段记忆细节",
      conversation_history: conversationHistory,
      conversation_round: {
        index: 9,
        trigger: "supplement",
        asked: true,
        replaced: false,
        answered: false,
        closed: true
      },
      user_skipped: true,
      question_state: {
        asked: true,
        replaced: false,
        answered: false,
        closed: true
      }
    },
    "ten-round-compose-test"
  );

  for (let index = 1; index <= 10; index += 1) {
    assert.match(result.story_text, new RegExp(`第${index}段记忆细节`));
  }
  assert.equal(
    result.evidence.filter((item) => item.level === "E1").length,
    10
  );
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

test("rate-limited style rewrite uses a meaning-preserving local adjustment", async () => {
  const config = loadConfig({ MEMENTO_MOCK_MODE: "true" });
  const promptLoader = await new PromptLoader(config.skillDirectory).initialize();
  let calls = 0;
  const service = new MementoService({
    config,
    modelClient: {
      async complete() {
        calls += 1;
        throw new AppError({
          code: "UPSTREAM_RATE_LIMITED",
          message: "busy",
          status: 503,
          retryable: true
        });
      }
    },
    promptLoader,
    logger: { info() {}, warn() {}, error() {} }
  });
  const currentDraft = {
    contract_version: "1.1",
    status: "needs_user_input",
    mode: "compose_memory",
    title: "64G的六年",
    source_line: "我和它的六年",
    summary: "一部依然好用的旧手机。",
    story_text:
      "这部手机很好用，但内存真的不够。如果一加还出直面屏手机，我可能就不会换苹果了。",
    curator_note: "生活比64G长得更快。",
    evidence: [],
    evidence_bindings: {},
    post_draft_actions: [],
    audit: { passed: true, unsupported_claims: [], warnings: [] }
  };

  const result = await service.process(
    {
      contract_version: "1.1",
      mode: "rewrite_text",
      raw_text: "这是我用了6年的手机。",
      current_draft: currentDraft,
      style: "light_poetic",
      draft_state: {
        base_draft_generated: true,
        revision_state: "in_progress",
        selected_preset: "light_poetic",
        custom_style_request: null
      }
    },
    "safe-rewrite-test"
  );

  assert.equal(calls, 1);
  assert.match(result.story_text, /不会换苹果/);
  assert.doesNotMatch(result.story_text, /不会选择离开苹果/);
  assert.match(result.story_text, /\n/);
  assert.equal(result.runtime?.model_used, "local-editorial-fallback");
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
