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
