import { AppError } from "./errors.js";
import {
  normalizeInput,
  parseJsonContent,
  validateComposeOutput,
  validateFollowupOutput,
  validatePrivateReferenceNames,
  validateRewriteOutput,
  validateVisualOutput
} from "./validation.js";

const TEXT_PARAMETERS = Object.freeze({
  thinking: { type: "enabled" },
  temperature: 0.7,
  maxTokens: 4096,
  responseFormat: { type: "json_object" }
});

const VISION_PARAMETERS = Object.freeze({
  thinking: { type: "disabled" },
  temperature: 0.1,
  maxTokens: 1024
});

const CLOSING_PATTERN =
  /(先这样|就这些|不想多说|差不多了|就这样收藏|不要问了|不想回答)/;

function allowedUses() {
  return ["title", "source_line", "summary", "story_text", "curator_note"];
}

function buildEvidence(input) {
  const evidence = [];
  let e1 = 1;
  let e2 = 1;

  for (const [source, content] of [
    ["raw_text", input.raw_text],
    ["transcript_text", input.transcript_text],
    ["follow_up_answer", input.follow_up_answer]
  ]) {
    if (!content) continue;
    evidence.push({
      id: `E1-${String(e1).padStart(2, "0")}`,
      level: "E1",
      source,
      content,
      allowed_uses: allowedUses()
    });
    e1 += 1;
  }

  for (const content of input.visual_evidence) {
    evidence.push({
      id: `E2-${String(e2).padStart(2, "0")}`,
      level: "E2",
      source: "visual_evidence",
      content,
      allowed_uses: allowedUses()
    });
    e2 += 1;
  }

  return evidence;
}

function modelSafeInput(input, evidence) {
  const {
    image: _image,
    current_draft,
    ...safeInput
  } = input;
  return {
    ...safeInput,
    image_ref: input.image ? "runtime-upload" : null,
    current_draft,
    evidence
  };
}

function instructionFor(mode) {
  if (mode === "ask_followup") {
    return [
      "执行 ask_followup。",
      "新记忆必须返回恰好一个自然、可跳过的追问。",
      "问题要追随物品背后的人、事情或感受，不要重复已知信息。",
      "严格使用 contract.md 的 Follow-up JSON 结构。"
    ].join("\n");
  }
  if (mode === "compose_memory") {
    return [
      "执行 compose_memory。",
      "整合全部用户输入，先生成 default_polish 成稿。",
      "不得新增事实，必须包含短来源和一句馆员评语。",
      "严格使用 contract.md 的 Composed memory JSON 结构。"
    ].join("\n");
  }
  if (mode === "rewrite_text") {
    return [
      "执行 rewrite_text。",
      "只改写 current_draft.story_text，其他字段和事实保持不变。",
      "将预设或自定义要求转换为高层风格特征。",
      "严格使用 contract.md 的 Rewrite JSON 结构。"
    ].join("\n");
  }
  return "严格按当前模式和 contract.md 返回 JSON。";
}

export class MementoService {
  constructor({ config, modelClient, promptLoader, logger = console }) {
    this.config = config;
    this.modelClient = modelClient;
    this.promptLoader = promptLoader;
    this.logger = logger;
  }

  async process(rawInput, requestId) {
    const input = normalizeInput(rawInput, this.config);

    if (input.image && input.visual_evidence.length === 0) {
      input.visual_evidence = await this.extractVisualEvidence(input, requestId);
    }

    const evidence = buildEvidence(input);
    const mode = this.selectMode(input);

    if (mode === "ask_followup") {
      return this.generateFollowup(input, evidence, requestId);
    }
    if (mode === "compose_memory") {
      return this.compose(input, evidence, requestId);
    }
    if (mode === "rewrite_text") {
      return this.rewrite(input, evidence, requestId);
    }

    throw new AppError({
      code: "INVALID_MODE",
      message: "当前验证版暂不支持这个编辑模式。",
      status: 400
    });
  }

  selectMode(input) {
    if (input.mode === "rewrite_text") return "rewrite_text";
    if (input.mode === "compose_memory") return "compose_memory";
    if (input.mode === "ask_followup") return "ask_followup";
    if (input.mode !== "auto") return input.mode;

    const boundaryClosed =
      input.user_skipped ||
      input.question_state.closed ||
      input.question_state.answered ||
      Boolean(input.follow_up_answer) ||
      CLOSING_PATTERN.test(input.raw_text);

    return boundaryClosed ? "compose_memory" : "ask_followup";
  }

  async extractVisualEvidence(input, requestId) {
    const prompt = [
      "只提取图片中直接可见的事实。",
      "可以写物体、场景、颜色、光线、物理状态和可见动作。",
      "禁止推断身份、关系、动机、情绪、历史、所有权、地点或图片外事件。",
      "每条事实使用简短中文。",
      '只返回 JSON：{"visual_evidence":["可见事实"]}'
    ].join("\n");
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: input.image.data_base64
            }
          },
          { type: "text", text: prompt }
        ]
      }
    ];

    return this.runJsonWithRepair({
      purpose: "vision",
      model: this.config.visionModel,
      messages,
      parameters: VISION_PARAMETERS,
      input,
      evidence: [],
      validate: (output) => validateVisualOutput(output),
      requestId
    });
  }

  async generateFollowup(input, evidence, requestId) {
    const mode = "ask_followup";
    const messages = this.buildTextMessages(mode, input, evidence);
    return this.runJsonWithRepair({
      purpose: "follow_up",
      model: this.config.textModel,
      messages,
      parameters: TEXT_PARAMETERS,
      input,
      evidence,
      validate: (output) =>
        validateFollowupOutput(output, {
          replaced: Boolean(input.question_state.replaced)
        }),
      requestId
    });
  }

  async compose(input, evidence, requestId) {
    const mode = "compose_memory";
    const messages = this.buildTextMessages(mode, input, evidence);
    return this.runJsonWithRepair({
      purpose: "compose",
      model: this.config.textModel,
      messages,
      parameters: TEXT_PARAMETERS,
      input,
      evidence,
      validate: validateComposeOutput,
      requestId
    });
  }

  async rewrite(input, evidence, requestId) {
    if (!input.current_draft) {
      throw new AppError({
        code: "MISSING_SOURCE_TEXT",
        message: "调整风格前需要先生成一版正文。",
        status: 400
      });
    }
    validateComposeOutput(input.current_draft);
    if (
      !input.style &&
      !input.draft_state.custom_style_request &&
      !input.rewrite_request
    ) {
      throw new AppError({
        code: "EMPTY_CUSTOM_STYLE_REQUEST",
        message: "请写下你希望正文怎么调整。",
        status: 400
      });
    }

    const mode = "rewrite_text";
    const messages = this.buildTextMessages(mode, input, evidence);
    const rewrite = await this.runJsonWithRepair({
      purpose: "rewrite",
      model: this.config.textModel,
      messages,
      parameters: TEXT_PARAMETERS,
      input,
      evidence,
      validate: validateRewriteOutput,
      requestId
    });

    const merged = {
      ...input.current_draft,
      status: "needs_user_input",
      mode: "compose_memory",
      draft_stage: "restyled",
      revision_state: "awaiting_direction",
      story_text: rewrite.rewritten_text,
      style_features: rewrite.style_features ?? [],
      edit_note: rewrite.edit_note ?? "",
      audit: rewrite.audit ?? input.current_draft.audit
    };
    return validateComposeOutput(merged);
  }

  buildTextMessages(mode, input, evidence) {
    const system = this.promptLoader.buildSystemPrompt(mode);
    const payload = modelSafeInput(input, evidence);
    return [
      { role: "system", content: system },
      {
        role: "user",
        content: `${instructionFor(mode)}\n\n当前流程输入：\n${JSON.stringify(payload)}`
      }
    ];
  }

  async runJsonWithRepair({
    purpose,
    model,
    messages,
    parameters,
    input,
    evidence,
    validate,
    requestId
  }) {
    let lastError;
    let activeMessages = messages;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.modelClient.complete({
          purpose: attempt === 0 ? purpose : `${purpose}_repair`,
          model,
          messages: activeMessages,
          input,
          evidence,
          ...parameters
        });
        const validated = validate(parseJsonContent(response.content));
        return purpose.startsWith("vision")
          ? validated
          : validatePrivateReferenceNames(validated, input);
      } catch (error) {
        lastError = error;
        if (
          attempt === 0 &&
          error instanceof AppError &&
          error.code === "MODEL_OUTPUT_INVALID"
        ) {
          activeMessages = [
            ...messages,
            {
              role: "user",
              content:
                "上一次结果没有通过契约校验。请重新生成完整、有效、无 Markdown 包裹的 JSON，并再次检查所有事实和字段。"
            }
          ];
          continue;
        }
        throw error;
      }
    }

    this.logger.error?.({
      requestId,
      code: lastError?.code ?? "MODEL_OUTPUT_INVALID",
      purpose
    });
    throw lastError;
  }
}
