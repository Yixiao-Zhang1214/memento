import { AppError } from "./errors.js";

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);
const FORBIDDEN_PUBLIC_KEYS = new Set([
  "reference_person",
  "author",
  "inspired_by",
  "style_imitation",
  "reasoning_content"
]);
const PERSONAL_INFERENCE_PATTERN =
  /(男朋友|女朋友|父亲|母亲|爸爸|妈妈|家人|恋人|夫妻|悲伤|开心|怀念|珍贵|可能|似乎|应该是|看起来很)/;
const MODES = new Set([
  "auto",
  "ask_followup",
  "compose_memory",
  "polish_text",
  "expand_text",
  "optimization_options",
  "rewrite_text",
  "audit_text"
]);
const STYLES = new Set([
  "truthful",
  "private_label",
  "light_poetic",
  "dry_humor",
  "fantasy_archive"
]);
const PRIVATE_REFERENCE_NAMES = [
  "李娟",
  "岩井俊二",
  "张爱玲",
  "汪曾祺",
  "三毛",
  "丰子恺",
  "王小波",
  "贾樟柯",
  "白先勇",
  "余华",
  "史铁生",
  "阿城"
];

const DEFAULT_QUESTION_STATE = Object.freeze({
  asked: false,
  replaced: false,
  answered: false,
  closed: false,
  previous_intent: null
});

const DEFAULT_DRAFT_STATE = Object.freeze({
  base_draft_generated: false,
  revision_state: "not_started",
  selected_preset: null,
  custom_style_request: null
});

function assertText(value, field, maxLength) {
  if (value == null) return "";
  if (typeof value !== "string") {
    throw new AppError({
      code: "INVALID_INPUT",
      message: `${field} 必须是文字。`,
      status: 400
    });
  }
  if (Array.from(value).length > maxLength) {
    throw new AppError({
      code: "INVALID_INPUT",
      message: `${field} 内容过长，请缩短后再试。`,
      status: 400
    });
  }
  return value.trim();
}

function decodedBase64Bytes(value) {
  const normalized = value.replace(/\s/g, "");
  const padding = normalized.endsWith("==")
    ? 2
    : normalized.endsWith("=")
      ? 1
      : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

function validateImage(image, maxImageBytes) {
  if (image == null) return null;
  if (typeof image !== "object" || Array.isArray(image)) {
    throw new AppError({
      code: "INVALID_INPUT",
      message: "图片格式不正确。",
      status: 400
    });
  }

  const mimeType = String(image.mime_type ?? "").toLowerCase();
  if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
    throw new AppError({
      code: "UNSUPPORTED_IMAGE_TYPE",
      message: "目前支持 JPEG、PNG 和 WebP 图片。",
      status: 400
    });
  }

  const dataBase64 = String(image.data_base64 ?? "").replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64)) {
    throw new AppError({
      code: "INVALID_INPUT",
      message: "图片内容无法读取，请重新选择。",
      status: 400
    });
  }

  if (decodedBase64Bytes(dataBase64) > maxImageBytes) {
    throw new AppError({
      code: "IMAGE_TOO_LARGE",
      message: "图片不能超过 10 MB。",
      status: 413
    });
  }

  return {
    mime_type: mimeType,
    data_base64: dataBase64
  };
}

export function normalizeInput(input, { maxImageBytes }) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AppError({
      code: "INVALID_INPUT",
      message: "请求内容格式不正确。",
      status: 400
    });
  }

  const contractVersion = input.contract_version ?? "1.1";
  if (contractVersion !== "1.1") {
    throw new AppError({
      code: "INVALID_CONTRACT_VERSION",
      message: "当前只支持 Memento 契约 1.1。",
      status: 400
    });
  }

  const rawText = assertText(input.raw_text, "记忆文字", 10_000);
  const transcriptText = assertText(
    input.transcript_text,
    "语音转写",
    10_000
  );
  const followUpAnswer = assertText(
    input.follow_up_answer,
    "追问回答",
    5_000
  );
  const existingText = assertText(input.existing_text, "已有正文", 20_000);
  const rewriteRequest = assertText(
    input.rewrite_request,
    "改写要求",
    1_000
  );

  const visualEvidence = Array.isArray(input.visual_evidence)
    ? input.visual_evidence
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12)
    : [];
  if (visualEvidence.length > 0) {
    validateVisualOutput({ visual_evidence: visualEvidence });
  }

  const mode = input.mode ?? "auto";
  if (!MODES.has(mode)) {
    throw new AppError({
      code: "INVALID_MODE",
      message: "当前不支持这个编辑模式。",
      status: 400
    });
  }
  const style = input.style ?? null;
  if (style != null && !STYLES.has(style)) {
    throw new AppError({
      code: "UNSUPPORTED_STYLE",
      message: "当前不支持这个正文风格。",
      status: 400
    });
  }

  const questionState = {
    ...DEFAULT_QUESTION_STATE,
    ...(input.question_state ?? {})
  };
  for (const field of ["asked", "replaced", "answered", "closed"]) {
    questionState[field] = input.question_state?.[field] === true;
  }
  const draftState = {
    ...DEFAULT_DRAFT_STATE,
    ...(input.draft_state ?? {})
  };
  draftState.custom_style_request = assertText(
    draftState.custom_style_request,
    "自定义风格",
    500
  );

  const normalized = {
    contract_version: "1.1",
    mode,
    image: validateImage(input.image, maxImageBytes),
    visual_evidence: visualEvidence,
    raw_text: rawText,
    transcript_text: transcriptText,
    follow_up_question: input.follow_up_question
      ? assertText(input.follow_up_question, "追问", 200)
      : null,
    follow_up_answer: followUpAnswer,
    user_skipped: Boolean(input.user_skipped),
    question_state: questionState,
    style,
    draft_state: draftState,
    rewrite_request: rewriteRequest || null,
    target_length: input.target_length ?? null,
    existing_text: existingText || null,
    current_draft:
      input.current_draft && typeof input.current_draft === "object"
        ? structuredClone(input.current_draft)
        : null
  };

  if (
    !rawText &&
    !transcriptText &&
    !normalized.image &&
    visualEvidence.length === 0 &&
    !existingText &&
    !normalized.current_draft
  ) {
    throw new AppError({
      code: "MISSING_MEMORY_INPUT",
      message: "请添加一张图片或写下一点内容。",
      status: 400
    });
  }

  return normalized;
}

export function parseJsonContent(content) {
  if (typeof content !== "string") {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "模型返回了无法读取的结果，请重试。",
      status: 502,
      retryable: true
    });
  }

  const trimmed = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  const candidate =
    firstBrace >= 0 && lastBrace > firstBrace
      ? trimmed.slice(firstBrace, lastBrace + 1)
      : trimmed;

  try {
    return JSON.parse(candidate);
  } catch (error) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "模型返回的文字结构不完整，请重试。",
      status: 502,
      retryable: true,
      cause: error
    });
  }
}

function walkObject(value, visitor) {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    visitor(key, nested);
    walkObject(nested, visitor);
  }
}

function assertNoForbiddenKeys(output) {
  let forbidden;
  walkObject(output, (key) => {
    if (FORBIDDEN_PUBLIC_KEYS.has(key)) forbidden = key;
  });
  if (forbidden) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "模型结果包含内部字段，请重试。",
      status: 502,
      retryable: true,
      details: { forbidden }
    });
  }
}

export function validateVisualOutput(output) {
  const values = output?.visual_evidence;
  if (!Array.isArray(values) || values.length === 0 || values.length > 12) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "图片事实提取结果不完整，请重试。",
      status: 502,
      retryable: true
    });
  }

  const cleaned = values.map((item) => {
    if (
      typeof item !== "string" ||
      item.trim() === "" ||
      Array.from(item).length > 120 ||
      PERSONAL_INFERENCE_PATTERN.test(item)
    ) {
      throw new AppError({
        code: "MODEL_OUTPUT_INVALID",
        message: "图片事实包含不可靠推断，请重试。",
        status: 502,
        retryable: true
      });
    }
    return item.trim();
  });
  return cleaned;
}

function assertBaseOutput(output, expectedMode) {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "模型结果格式不正确，请重试。",
      status: 502,
      retryable: true
    });
  }
  assertNoForbiddenKeys(output);
  if (output.contract_version !== "1.1" || output.mode !== expectedMode) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "模型结果与当前流程不一致，请重试。",
      status: 502,
      retryable: true
    });
  }
}

export function validateFollowupOutput(output, { replaced = false } = {}) {
  assertBaseOutput(output, "ask_followup");
  if (
    output.status !== "needs_user_input" ||
    output.needs_followup !== true ||
    typeof output.question !== "string" ||
    output.question.trim() === ""
  ) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "模型没有生成可用的追问，请重试。",
      status: 502,
      retryable: true
    });
  }

  const questionMarks = (output.question.match(/[?？]/g) ?? []).length;
  if (questionMarks > 1 || Array.from(output.question).length > 70) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "模型生成的追问不够清楚，请重试。",
      status: 502,
      retryable: true
    });
  }

  const actionIds = Array.isArray(output.user_actions)
    ? output.user_actions.map((action) => action?.id)
    : [];
  const expected = replaced
    ? ["compose_now"]
    : ["replace_question", "compose_now"];
  if (
    actionIds.length !== expected.length ||
    expected.some((id) => !actionIds.includes(id))
  ) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "追问操作不完整，请重试。",
      status: 502,
      retryable: true
    });
  }
  return output;
}

export function validateFollowupRelevance(output, input = {}) {
  const question = String(output?.question ?? "");
  const supplied = [
    input.raw_text,
    input.transcript_text,
    ...(Array.isArray(input.visual_evidence) ? input.visual_evidence : [])
  ]
    .filter(Boolean)
    .join(" ");

  const asksWhen = /(什么时候|哪年|哪一年|多久|多少年|多长时间)/.test(
    question
  );
  const alreadyHasTime =
    /(?:\d+|[一二三四五六七八九十两半]+)\s*(?:年|个月|月|周|天)|(?:去年|前年|今年|大学时|上学时|刚工作|小时候)/.test(
      supplied
    );
  const asksReplacementReason =
    /(为什么|为何|什么原因|是什么让).*(?:换|不用|不再用|放弃|淘汰)|(?:换|不用|不再用|放弃|淘汰).*(为什么|为何|什么原因)/.test(
      question
    );
  const alreadyHasReplacementReason =
    /(?:因为|由于|原因是).{0,30}(?:内存|容量|空间|坏|摔|丢|不能用|不够)|(?:内存|容量|空间).{0,12}(?:不够|不足|满了)|没办法.{0,12}继续使用/.test(
      supplied
    );
  const asksKnownTravelNext =
    /(?:接下来|然后|之后).{0,10}(?:做什么|去哪|去哪里)/.test(question) &&
    /出差/.test(supplied);
  const asksKnownReply =
    /(?:怎么|如何|有没有|是否).{0,8}(?:回答|回应|答应)|你.{0,8}(?:说了什么|答应了吗)/.test(
      question
    ) && /我说(?:好|可以|愿意)|我答应/.test(supplied);
  const hasTextFirstTarget = /(关键词|口号|标语|一句话)/.test(supplied);
  const followsTextFirstTarget =
    /(关键词|口号|标语|这句话|为什么.{0,8}留|想.{0,8}留下)/.test(
      question
    );

  if (
    (asksWhen && alreadyHasTime) ||
    (asksReplacementReason && alreadyHasReplacementReason) ||
    asksKnownTravelNext ||
    asksKnownReply ||
    (hasTextFirstTarget && !followsTextFirstTarget)
  ) {
    const reason =
      hasTextFirstTarget && !followsTextFirstTarget
        ? "QUESTION_MISSES_TEXT_TARGET"
        : "QUESTION_REPEATS_KNOWN_INFORMATION";
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message:
        reason === "QUESTION_MISSES_TEXT_TARGET"
          ? "追问只停留在图片，没有跟随用户主动写下的内容。请围绕那句话或它背后的事情提问。"
          : "追问重复了用户已经说明的信息。请换一个能为正文增加新内容的自然问题。",
      status: 502,
      retryable: true,
      details: { reason }
    });
  }

  return output;
}

function assertStringField(output, field) {
  if (typeof output[field] !== "string" || output[field].trim() === "") {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: `模型没有生成${field}，请重试。`,
      status: 502,
      retryable: true
    });
  }
}

export function validateComposeOutput(output) {
  assertBaseOutput(output, "compose_memory");
  for (const field of [
    "title",
    "source_line",
    "summary",
    "story_text",
    "curator_note"
  ]) {
    assertStringField(output, field);
  }

  const sourceLength = Array.from(output.source_line).length;
  if (sourceLength < 4 || sourceLength > 18) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "来源文字长度不符合要求，请重试。",
      status: 502,
      retryable: true
    });
  }

  const curatorSentenceMarks = (
    output.curator_note.match(/[。！？!?]/g) ?? []
  ).length;
  if (curatorSentenceMarks > 1) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "馆员评语必须是一句话，请重试。",
      status: 502,
      retryable: true
    });
  }

  const evidenceIds = new Set(
    Array.isArray(output.evidence)
      ? output.evidence.map((item) => item?.id).filter(Boolean)
      : []
  );
  walkObject(output.evidence_bindings, (_key, value) => {
    if (Array.isArray(value)) {
      for (const id of value) {
        if (typeof id === "string" && !evidenceIds.has(id)) {
          throw new AppError({
            code: "MODEL_OUTPUT_INVALID",
            message: "模型引用了不存在的证据，请重试。",
            status: 502,
            retryable: true
          });
        }
      }
    }
  });

  return output;
}

export function validateComposeEvidence(output, input = {}) {
  const supplied = [
    input.raw_text,
    input.transcript_text,
    input.follow_up_answer,
    ...(Array.isArray(input.visual_evidence) ? input.visual_evidence : [])
  ]
    .filter(Boolean)
    .join(" ");
  const generated = [
    output.title,
    output.source_line,
    output.summary,
    output.story_text,
    output.curator_note
  ]
    .filter(Boolean)
    .join(" ");
  const timeClaims =
    generated.match(/(?:19|20)\d{2}年|去年|前年|今年|上个月|下个月/g) ?? [];
  const unsupported = timeClaims.find((claim) => !supplied.includes(claim));

  if (unsupported) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "成稿加入了用户没有提供的时间。请删除该时间，不要推算年份。",
      status: 502,
      retryable: true,
      details: {
        reason: "UNSUPPORTED_TIME_CLAIM",
        claim: unsupported
      }
    });
  }

  const sourceNarrative = [
    input.raw_text,
    input.transcript_text,
    input.follow_up_answer
  ]
    .filter(Boolean)
    .join(" ");
  const sourceLength = Array.from(sourceNarrative).length;
  const storyLength = Array.from(output.story_text ?? "").length;
  const maximumPolishLength = Math.max(80, Math.ceil(sourceLength * 1.45));

  if (sourceLength > 0 && storyLength > maximumPolishLength) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message:
        "默认润色显著扩写了用户原文。请只整合、去重和调整语序，不要补充新的经历或感受。",
      status: 502,
      retryable: true,
      details: { reason: "UNSUPPORTED_NARRATIVE_EXPANSION" }
    });
  }

  const unsupportedNarrativeClaims = [
    "难忘",
    "我怀念",
    "向前看",
    "生活的一部分",
    "不仅仅是",
    "承载着",
    "承载了",
    "见证了",
    "教会我",
    "让我明白",
    "陪我度过",
    "流畅运行",
    "手机的性能",
    "通讯工具"
  ];
  const unsupportedClaim = unsupportedNarrativeClaims.find(
    (claim) =>
      String(output.story_text ?? "").includes(claim) &&
      !sourceNarrative.includes(claim)
  );
  if (unsupportedClaim) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message:
        "默认润色加入了用户没有表达的经历、情绪或意义。请删除这些内容，只保留用户提供的事实。",
      status: 502,
      retryable: true,
      details: {
        reason: "UNSUPPORTED_NARRATIVE_CLAIM",
        claim: unsupportedClaim
      }
    });
  }

  const generatedCorpus = [
    output.title,
    output.source_line,
    output.summary,
    output.story_text,
    output.curator_note
  ]
    .filter(Boolean)
    .join(" ");
  const ignoredCharacters = new Set(
    Array.from(
      "，。！？、；：,.!?;:（）()“”\"'的是了在我你他她它这那有和就也都很又把被给着过一个因为所以而与及"
    )
  );
  const evidenceSegments = [
    input.raw_text,
    input.transcript_text,
    input.follow_up_answer
  ].filter(Boolean);
  const missingSegment = evidenceSegments.find((segment) => {
    const meaningful = [
      ...new Set(
        Array.from(segment).filter(
          (character) =>
            !ignoredCharacters.has(character) && !/\s/.test(character)
        )
      )
    ];
    if (meaningful.length < 4) return false;
    const retained = meaningful.filter((character) =>
      generatedCorpus.includes(character)
    ).length;
    return retained / meaningful.length < 0.55;
  });

  if (missingSegment) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message:
        "成稿遗漏了用户输入中的关键信息。请保留用户主动写下的人名、组织、原话和关键事件。",
      status: 502,
      retryable: true,
      details: { reason: "INSUFFICIENT_EVIDENCE_COVERAGE" }
    });
  }

  return output;
}

export function validateRewriteOutput(output) {
  assertBaseOutput(output, "rewrite_text");
  assertStringField(output, "rewritten_text");
  if (
    output.style_features != null &&
    !Array.isArray(output.style_features)
  ) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "风格调整结果不完整，请重试。",
      status: 502,
      retryable: true
    });
  }
  return output;
}

export function validateRewriteEvidence(output, input = {}) {
  const currentDraft = input.current_draft ?? {};
  const currentStory = String(currentDraft.story_text ?? "");
  const currentCorpus = [
    currentDraft.title,
    currentDraft.source_line,
    currentDraft.summary,
    currentDraft.story_text,
    currentDraft.curator_note
  ]
    .filter(Boolean)
    .join(" ");

  validateComposeEvidence(
    {
      ...currentDraft,
      story_text: output.rewritten_text
    },
    {
      raw_text: currentCorpus,
      transcript_text: "",
      follow_up_answer: "",
      visual_evidence: []
    }
  );

  const customRequest = [
    input.rewrite_request,
    input.draft_state?.custom_style_request
  ]
    .filter(Boolean)
    .join(" ");
  const permitsSecondPerson = /第二人称|改成你|用你来写/.test(customRequest);
  if (
    currentStory.includes("我") &&
    !output.rewritten_text.includes("我") &&
    output.rewritten_text.includes("你") &&
    !permitsSecondPerson
  ) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "风格调整改变了正文的人称。请保留原来的叙述者。",
      status: 502,
      retryable: true,
      details: { reason: "UNSUPPORTED_VOICE_SHIFT" }
    });
  }

  return output;
}

export function validatePrivateReferenceNames(output, input) {
  const userSuppliedText = [
    input.raw_text,
    input.transcript_text,
    input.follow_up_answer,
    input.rewrite_request,
    input.draft_state?.custom_style_request,
    input.existing_text
  ]
    .filter(Boolean)
    .join("\n");
  const serialized = JSON.stringify(output);
  const leaked = PRIVATE_REFERENCE_NAMES.find(
    (name) => serialized.includes(name) && !userSuppliedText.includes(name)
  );
  if (leaked) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "模型结果暴露了内部风格参考，请重试。",
      status: 502,
      retryable: true
    });
  }
  return output;
}
