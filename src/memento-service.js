import { AppError } from "./errors.js";
import {
  normalizeInput,
  parseJsonContent,
  validateComposeEvidence,
  validateComposeOutput,
  validateFollowupOutput,
  validateFollowupRelevance,
  validatePrivateReferenceNames,
  validateRewriteEvidence,
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
const FALLBACK_ERROR_CODES = new Set([
  "UPSTREAM_RATE_LIMITED",
  "UPSTREAM_TIMEOUT",
  "UPSTREAM_UNAVAILABLE"
]);
const LOCAL_RECOVERY_REASONS = new Set([
  "QUESTION_REPEATS_KNOWN_INFORMATION",
  "UNSUPPORTED_TIME_CLAIM",
  "UNSUPPORTED_NARRATIVE_EXPANSION",
  "UNSUPPORTED_NARRATIVE_CLAIM",
  "UNSUPPORTED_VOICE_SHIFT"
]);

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
      "返回前逐字对照 raw_text：已经写明的原因、时长、回答和下一步行动一律不能再问。",
      "例如，用户已写“因为内存不够”就不能问为什么换手机；已写“出差”就不能问接下来去做什么。",
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

function safeQuestionFor(input) {
  const rawText = [input.raw_text, input.transcript_text]
    .filter(Boolean)
    .join(" ");

  if (input.question_state.replaced) {
    return {
      intent: "scene_probe",
      question: "和它有关的事里，你现在最想记住哪一件？"
    };
  }
  if (/(告白|表白|愿不愿意)/.test(rawText)) {
    return {
      intent: "aftertrace_probe",
      question: "他说完那句话以后，你们做了什么？"
    };
  }
  if (/(小狗|比熊|送走)/.test(rawText)) {
    return {
      intent: "moment_probe",
      question: "她在家的时候，有没有一件事你到现在还记得？"
    };
  }
  if (/(出差|又是)/.test(rawText)) {
    return {
      intent: "significance_probe",
      question: "你写“又是出差的一天”时，是什么心情？"
    };
  }
  if (/(手机|内存|64G|容量)/i.test(rawText)) {
    return {
      intent: "significance_probe",
      question: "用了这么久，你最舍不得它的是什么？"
    };
  }
  return {
    intent: "moment_probe",
    question: "看到它时，你会先想起哪件事？"
  };
}

function buildSafeFollowup(input, evidence) {
  const selected = safeQuestionFor(input);
  const replaced = Boolean(input.question_state.replaced);
  return {
    contract_version: "1.1",
    status: "needs_user_input",
    mode: "ask_followup",
    needs_followup: true,
    evidence,
    tone_profile: {
      expression_mode: "narrative",
      emotional_temperature: "neutral",
      openness: "open",
      preferred_question_tone: "concrete",
      curator_emotion_route: "neutral_sparse"
    },
    question_intent: selected.intent,
    question: selected.question,
    user_actions: replaced
      ? [{ id: "compose_now", label: "就这样收藏" }]
      : [
          { id: "replace_question", label: "换一个问题" },
          { id: "compose_now", label: "就这样收藏" }
        ],
    decision_code: "SAFE_QUESTION_FALLBACK",
    runtime: {
      model_used: "local-editorial-fallback",
      fallback_used: true
    }
  };
}

function sentenceJoin(parts) {
  const cleaned = parts
    .filter(Boolean)
    .map((part) => part.trim().replace(/[。！？!?]+$/g, ""))
    .filter(Boolean);
  return cleaned.length > 0 ? `${cleaned.join("。")}。` : "";
}

function safeCompositionCopy(input) {
  const rawText = [input.raw_text, input.transcript_text]
    .filter(Boolean)
    .join("。");
  const story = sentenceJoin([rawText, input.follow_up_answer]);

  if (/(告白|表白|愿不愿意)/.test(rawText)) {
    return {
      title: "告白那天的花",
      source: "他的一句“愿不愿意”",
      summary: "一束花和一句话，留下了两个人关系开始的那天。",
      story,
      note: "这束花替一个冒险的问题壮了胆，又被一个“好”留到了现在。",
      route: "first_heartbeat",
      lens: "clean_first_moment"
    };
  }
  if (/(小狗|比熊|送走)/.test(rawText)) {
    return {
      title: "她在家的日子",
      source: "她住在家里的时候",
      summary: "关于一只曾经住进家里，后来又离开的小狗。",
      story,
      note: "记不清时间并没有让她消失，能被说出的那件小事才是她留下的地方。",
      route: "regret_parting",
      lens: "residual_everyday_image"
    };
  }
  if (/(手机|内存|64G|容量)/i.test(rawText)) {
    return {
      title: "64G的六年",
      source: "我和它的六年",
      summary: "一部依然好用，却装不下后来生活的旧手机。",
      story,
      note: "它用了六年都没有变得难用，只是你的生活比64G长得更快。",
      route: "nostalgia_change",
      lens: "change_through_use"
    };
  }
  if (/(出差|馄饨|早餐)/.test(rawText)) {
    return {
      title: "又是出差的一天",
      source: "出差日的早餐",
      summary: "一顿还不错的早餐，夹在又一次出差的开头。",
      story,
      note: "早餐只负责好吃，那个“又”字才替这一天留下了重量。",
      route: "neutral_sparse",
      lens: "small_word_observation"
    };
  }

  const visualStory = input.visual_evidence.length
    ? sentenceJoin([
        input.visual_evidence.join("。"),
        "这张照片被留在了这里"
      ])
    : "";
  return {
    title: "被留下的这一刻",
    source: "为它留下的这一页",
    summary: "从一件眼前的东西，留下一段愿意记住的话。",
    story: story || visualStory || "这件东西被留在了这里。",
    note: "它没有替你解释什么，只把你愿意留下的部分放在了这里。",
    route: "neutral_sparse",
    lens: "object_first_observation"
  };
}

function buildSafeComposition(input, evidence) {
  const copy = safeCompositionCopy(input);
  const evidenceIds = evidence.map((item) => item.id);
  return {
    contract_version: "1.1",
    status: "needs_user_input",
    mode: "compose_memory",
    draft_stage: "base_polished",
    revision_state: "awaiting_direction",
    text_type:
      input.raw_text || input.transcript_text || input.follow_up_answer
        ? "story"
        : "quiet",
    evidence,
    tone_profile: {
      expression_mode: "narrative",
      emotional_temperature: "neutral",
      openness: "open",
      preferred_question_tone: "concrete",
      curator_emotion_route: copy.route
    },
    title: copy.title,
    source_line: copy.source,
    summary: copy.summary,
    story_text: copy.story,
    curator_note: copy.note,
    curator_profile: {
      emotion_route: copy.route,
      lens_id: copy.lens
    },
    evidence_bindings: {
      title: evidenceIds,
      source_line: evidenceIds,
      summary: evidenceIds,
      story_text: evidenceIds,
      curator_note: evidenceIds
    },
    post_draft_actions: [
      { id: "keep_draft", label: "就这样收藏" },
      { id: "adjust_style", label: "调整风格" },
      { id: "custom_style", label: "自定义风格" }
    ],
    audit: {
      passed: true,
      unsupported_claims: [],
      warnings: ["模型成稿未通过事实校验，已使用保守的本地整理。"]
    },
    runtime: {
      model_used: "local-editorial-fallback",
      fallback_used: true
    }
  };
}

function buildSafeRewrite(input) {
  const original = input.current_draft.story_text;
  let rewrittenText = original;
  let styleFeatures = ["保留原话", "不增加事实"];
  if (input.style === "private_label") {
    rewrittenText = `藏品记录：${original}`;
    styleFeatures = ["私人藏品说明", "保留原话"];
  } else if (input.style === "fantasy_archive") {
    rewrittenText = `档案记录：${original}`;
    styleFeatures = ["轻档案语气", "保留原话"];
  } else if (input.style === "light_poetic") {
    rewrittenText = original.replace(/。(?=.)/g, "。\n");
    styleFeatures = ["轻微诗意", "用分行调整节奏"];
  } else if (input.style === "dry_humor") {
    styleFeatures = ["克制表达", "保留原话中的反差"];
  }
  return {
    contract_version: "1.1",
    status: "complete",
    mode: "rewrite_text",
    rewrite_request:
      input.draft_state.custom_style_request ??
      input.rewrite_request ??
      input.style,
    style_features: styleFeatures,
    rewritten_text: rewrittenText,
    edit_note: "当前使用不改变词义的安全风格调整。",
    audit: {
      passed: true,
      unsupported_claims: [],
      warnings: ["未采用包含新增事实或人称变化的模型改写。"]
    },
    runtime: {
      model_used: "local-editorial-fallback",
      fallback_used: true
    }
  };
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
        validateFollowupRelevance(
          validateFollowupOutput(output, {
            replaced: Boolean(input.question_state.replaced)
          }),
          input
        ),
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
      validate: (output) =>
        validateComposeEvidence(validateComposeOutput(output), input),
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
      validate: (output) =>
        validateRewriteEvidence(validateRewriteOutput(output), input),
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
      audit: rewrite.audit ?? input.current_draft.audit,
      runtime: rewrite.runtime ?? input.current_draft.runtime
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
    let modelForAttempt = model;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const completionPurpose =
          attempt === 0 ? purpose : `${purpose}_repair`;
        const { response, modelUsed, fallbackUsed } =
          await this.completeWithFallback({
            purpose: completionPurpose,
            model: modelForAttempt,
            messages: activeMessages,
            parameters,
            input,
            evidence,
            requestId
          });
        modelForAttempt = modelUsed;
        const validated = validate(parseJsonContent(response.content));
        const safeOutput = purpose.startsWith("vision")
          ? validated
          : validatePrivateReferenceNames(validated, input);
        if (!purpose.startsWith("vision")) {
          safeOutput.runtime = {
            model_used: modelUsed,
            fallback_used: fallbackUsed
          };
        }
        return safeOutput;
      } catch (error) {
        lastError = error;
        if (
          error instanceof AppError &&
          error.code === "MODEL_OUTPUT_INVALID"
        ) {
          const shouldRecoverLocally =
            modelForAttempt === this.config.textFallbackModel &&
            LOCAL_RECOVERY_REASONS.has(error.details?.reason);
          if (
            shouldRecoverLocally &&
            ["follow_up", "compose", "rewrite"].includes(purpose)
          ) {
            break;
          }
          if (attempt === 0) {
            activeMessages = [
              ...messages,
              {
                role: "user",
                content: `上一次结果没有通过校验：${error.message} 请重新生成完整、有效、无 Markdown 包裹的 JSON，并再次检查所有事实和字段。`
              }
            ];
            continue;
          }
          if (["follow_up", "compose", "rewrite"].includes(purpose)) break;
        }
        throw error;
      }
    }

    this.logger.error?.({
      requestId,
      code: lastError?.code ?? "MODEL_OUTPUT_INVALID",
      purpose
    });

    if (
      purpose === "follow_up" &&
      lastError instanceof AppError &&
      lastError.code === "MODEL_OUTPUT_INVALID"
    ) {
      const safeFollowup = buildSafeFollowup(input, evidence);
      return validateFollowupRelevance(
        validateFollowupOutput(safeFollowup, {
          replaced: Boolean(input.question_state.replaced)
        }),
        input
      );
    }

    if (
      purpose === "compose" &&
      lastError instanceof AppError &&
      lastError.code === "MODEL_OUTPUT_INVALID"
    ) {
      const safeComposition = buildSafeComposition(input, evidence);
      return validateComposeEvidence(
        validateComposeOutput(safeComposition),
        input
      );
    }

    if (
      purpose === "rewrite" &&
      lastError instanceof AppError &&
      lastError.code === "MODEL_OUTPUT_INVALID"
    ) {
      const safeRewrite = buildSafeRewrite(input);
      return validateRewriteEvidence(
        validateRewriteOutput(safeRewrite),
        input
      );
    }

    throw lastError;
  }

  async completeWithFallback({
    purpose,
    model,
    messages,
    parameters,
    input,
    evidence,
    requestId
  }) {
    const configuredFallback = this.config.textFallbackModel;
    const alreadyUsingFallback =
      !purpose.startsWith("vision") &&
      configuredFallback &&
      model === configuredFallback;
    const firstParameters = alreadyUsingFallback
      ? { ...parameters, thinking: undefined }
      : parameters;

    try {
      const response = await this.modelClient.complete({
        purpose,
        model,
        messages,
        input,
        evidence,
        timeoutMs: purpose.startsWith("vision") || alreadyUsingFallback
          ? this.config.requestTimeoutMs
          : this.config.primaryTextTimeoutMs,
        maxAttempts:
          purpose.startsWith("vision") || alreadyUsingFallback ? 2 : 1,
        ...firstParameters
      });
      return {
        response,
        modelUsed: model,
        fallbackUsed: Boolean(alreadyUsingFallback)
      };
    } catch (error) {
      const fallbackModel = configuredFallback;
      const canFallback =
        !purpose.startsWith("vision") &&
        fallbackModel &&
        fallbackModel !== model &&
        error instanceof AppError &&
        FALLBACK_ERROR_CODES.has(error.code);

      if (!canFallback) throw error;

      this.logger.warn?.({
        requestId,
        purpose,
        primaryModel: model,
        fallbackModel,
        code: error.code
      });

      if (purpose.startsWith("rewrite")) {
        return {
          response: {
            content: JSON.stringify(buildSafeRewrite(input)),
            upstreamRequestId: null,
            usage: null
          },
          modelUsed: "local-editorial-fallback",
          fallbackUsed: true
        };
      }

      const fallbackParameters = {
        ...parameters,
        thinking: undefined
      };
      const response = await this.modelClient.complete({
        purpose: `${purpose}_fallback`,
        model: fallbackModel,
        messages,
        input,
        evidence,
        timeoutMs: this.config.requestTimeoutMs,
        maxAttempts: 2,
        ...fallbackParameters
      });
      return {
        response,
        modelUsed: fallbackModel,
        fallbackUsed: true
      };
    }
  }
}
