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
  "finalize_memory",
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
const CONVERSATION_ROLES = new Set(["user", "assistant"]);
const CONVERSATION_KINDS = new Set([
  "initial",
  "supplement",
  "question",
  "answer"
]);
const CONVERSATION_TRIGGERS = new Set([
  "initial",
  "supplement",
  "ask_more"
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
const CURATOR_ROUTES = new Set([
  "tender_daily",
  "first_heartbeat",
  "intimate_tension",
  "family_old_days",
  "friendship_complicity",
  "bright_delight",
  "absurd_self_mockery",
  "nostalgia_change",
  "regret_parting",
  "grief_loss",
  "endurance_afterward",
  "neutral_sparse"
]);
const CURATOR_MOVES = new Set([
  "object_role",
  "factual_contrast",
  "small_action_consequence",
  "kept_vs_gone",
  "material_time",
  "unsaid_tension",
  "shared_complicity",
  "ordinary_absence",
  "limit_and_continuance",
  "exact_object_observation"
]);
const ROUTE_MOVES = Object.freeze({
  tender_daily: new Set(["object_role", "small_action_consequence"]),
  first_heartbeat: new Set(["small_action_consequence", "object_role"]),
  intimate_tension: new Set(["factual_contrast", "unsaid_tension"]),
  family_old_days: new Set(["object_role", "material_time"]),
  friendship_complicity: new Set([
    "shared_complicity",
    "small_action_consequence"
  ]),
  bright_delight: new Set(["factual_contrast", "small_action_consequence"]),
  absurd_self_mockery: new Set(["factual_contrast", "object_role"]),
  nostalgia_change: new Set(["material_time", "kept_vs_gone"]),
  regret_parting: new Set(["kept_vs_gone", "unsaid_tension"]),
  grief_loss: new Set(["ordinary_absence", "kept_vs_gone"]),
  endurance_afterward: new Set(["limit_and_continuance", "object_role"]),
  neutral_sparse: new Set(["exact_object_observation", "object_role"])
});
const GENERIC_CURATOR_PATTERN =
  /(值得.{0,4}珍藏|见证.{0,4}成长|平凡中.{0,4}不平凡|这就是.{0,4}模样|承载着.{0,8}回忆|岁月的见证|珍贵的回忆|永远留在|生活的一部分)/;
const HUMOR_PATTERN =
  /(哈哈|好笑|搞笑|活该|笑话|荒唐|离谱|拿捏|钉子户|输得|赢得|打败|审美输)/;
const HUMOR_DISABLED_ROUTES = new Set([
  "intimate_tension",
  "regret_parting",
  "grief_loss",
  "endurance_afterward"
]);

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

function normalizeConversationHistory(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new AppError({
      code: "INVALID_INPUT",
      message: "对话历史格式不正确。",
      status: 400
    });
  }

  const seenIds = new Set();
  const history = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new AppError({
        code: "INVALID_INPUT",
        message: "对话历史包含无效项目。",
        status: 400
      });
    }
    const id = assertText(item.id, "对话项目 ID", 120);
    const role = String(item.role ?? "");
    const kind = String(item.kind ?? "");
    const round = Number(item.round);
    const content = assertText(item.content, "对话内容", 5_000);
    if (!id || !content) {
      throw new AppError({
        code: "INVALID_INPUT",
        message: "对话项目缺少 ID 或内容。",
        status: 400
      });
    }
    if (
      !CONVERSATION_ROLES.has(role) ||
      !CONVERSATION_KINDS.has(kind) ||
      !Number.isInteger(round) ||
      round < 0
    ) {
      throw new AppError({
        code: "INVALID_INPUT",
        message: "对话项目的角色、类型或轮次不正确。",
        status: 400
      });
    }
    const roleMatchesKind =
      (role === "assistant" && kind === "question") ||
      (role === "user" && kind !== "question");
    if (!roleMatchesKind) {
      throw new AppError({
        code: "INVALID_INPUT",
        message: "对话项目的角色与类型不一致。",
        status: 400
      });
    }
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    history.push({ id, round, role, kind, content });
  }
  return history;
}

function normalizeConversationRound(value) {
  const source =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const index = Number(source.index ?? 0);
  const trigger = String(source.trigger ?? "initial");
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    !CONVERSATION_TRIGGERS.has(trigger)
  ) {
    throw new AppError({
      code: "INVALID_INPUT",
      message: "当前对话轮次格式不正确。",
      status: 400
    });
  }
  return {
    index,
    trigger,
    asked: source.asked === true,
    replaced: source.replaced === true,
    answered: source.answered === true,
    closed: source.closed === true,
    previous_intent:
      typeof source.previous_intent === "string"
        ? source.previous_intent.slice(0, 120)
        : null
  };
}

function conversationUserContents(input) {
  return Array.isArray(input?.conversation_history)
    ? input.conversation_history
        .filter((item) => item?.role === "user")
        .map((item) => item.content)
        .filter(Boolean)
    : [];
}

function allUserInputSegments(input) {
  return [
    ...conversationUserContents(input),
    input?.raw_text,
    input?.transcript_text,
    input?.follow_up_answer
  ]
    .filter(Boolean)
    .filter((content, index, values) => values.indexOf(content) === index);
}

function normalizeQuestionText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[，。！？、；：,.!?;:\s“”"'（）()]/g, "")
    .replace(/你还记得|你能不能|可以说说|有没有|是什么|吗|呢/g, "");
}

function questionBigrams(value) {
  const normalized = normalizeQuestionText(value);
  if (normalized.length < 2) return new Set([normalized]);
  const pairs = new Set();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    pairs.add(normalized.slice(index, index + 2));
  }
  return pairs;
}

function questionsAreSimilar(first, second) {
  const left = normalizeQuestionText(first);
  const right = normalizeQuestionText(second);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const leftPairs = questionBigrams(left);
  const rightPairs = questionBigrams(right);
  let overlap = 0;
  for (const pair of leftPairs) {
    if (rightPairs.has(pair)) overlap += 1;
  }
  return (2 * overlap) / (leftPairs.size + rightPairs.size) >= 0.72;
}

function currentSupplement(input) {
  if (input?.conversation_round?.trigger !== "supplement") return "";
  return Array.isArray(input.conversation_history)
    ? input.conversation_history
        .filter(
          (item) =>
            item?.role === "user" &&
            item?.kind === "supplement" &&
            item?.round === input.conversation_round.index
        )
        .at(-1)?.content ?? ""
    : "";
}

function questionFollowsSupplement(question, supplement) {
  if (Array.from(supplement).length < 4) return true;
  if (
    /(刚补充|这件事|这次|当时|那天|那张|后来|说完|照片|合照)/.test(
      question
    )
  ) {
    return true;
  }
  const ignored = new Set(
    Array.from("，。！？、；：,.!?;:（）()“”\"'的是了在我你他她它这那有和就也都很又把被给着过一个最时用")
  );
  const supplementCharacters = new Set(
    Array.from(supplement).filter(
      (character) => !ignored.has(character) && !/\s/.test(character)
    )
  );
  return Array.from(question).some((character) =>
    supplementCharacters.has(character)
  );
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
  const conversationHistory = normalizeConversationHistory(
    input.conversation_history
  );
  const conversationRound = normalizeConversationRound(
    input.conversation_round
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
    conversation_history: conversationHistory,
    conversation_round: conversationRound,
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
    conversationUserContents(normalized).length === 0 &&
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
    ...allUserInputSegments(input),
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
  const asksKnownAttachment =
    /最舍不得.{0,12}(?:是什么|什么|哪一点|哪里)/.test(question) &&
    /最舍不得.{0,24}(?:是|的就是|因为)/.test(supplied);
  const hasTextFirstTarget = /(关键词|口号|标语|一句话)/.test(supplied);
  const followsTextFirstTarget =
    /(关键词|口号|标语|这句话|为什么.{0,8}留|想.{0,8}留下)/.test(
      question
    );
  const priorQuestions = Array.isArray(input.conversation_history)
    ? input.conversation_history
        .filter(
          (item) => item?.role === "assistant" && item?.kind === "question"
        )
        .map((item) => item.content)
    : [];
  const repeatsHistory = priorQuestions.some((previous) =>
    questionsAreSimilar(question, previous)
  );
  const supplement = currentSupplement(input);
  const missesCurrentSupplement =
    Boolean(supplement) && !questionFollowsSupplement(question, supplement);

  if (
    (asksWhen && alreadyHasTime) ||
    (asksReplacementReason && alreadyHasReplacementReason) ||
    asksKnownTravelNext ||
    asksKnownReply ||
    asksKnownAttachment ||
    (hasTextFirstTarget && !followsTextFirstTarget) ||
    missesCurrentSupplement ||
    repeatsHistory
  ) {
    let reason = "QUESTION_REPEATS_KNOWN_INFORMATION";
    if (repeatsHistory) {
      reason = "QUESTION_REPEATS_HISTORY";
    } else if (missesCurrentSupplement) {
      reason = "QUESTION_MISSES_CURRENT_SUPPLEMENT";
    } else if (hasTextFirstTarget && !followsTextFirstTarget) {
      reason = "QUESTION_MISSES_TEXT_TARGET";
    }
    let message =
      "追问重复了用户已经说明的信息。请换一个能为正文增加新内容的自然问题。";
    if (reason === "QUESTION_REPEATS_HISTORY") {
      message = "这个问题已经问过了。请换一个能增加新内容的角度。";
    } else if (reason === "QUESTION_MISSES_CURRENT_SUPPLEMENT") {
      message =
        "这个问题没有顺着用户本轮刚补充的内容。请先围绕本轮新增的人、事或细节提问。";
    } else if (reason === "QUESTION_MISSES_TEXT_TARGET") {
      message =
        "追问只停留在图片，没有跟随用户主动写下的内容。请围绕那句话或它背后的事情提问。";
    }
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message,
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
  for (const field of ["title", "source_line", "summary", "story_text"]) {
    assertStringField(output, field);
  }
  if (output.curator_note != null || output.curator_profile != null) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "编辑中的草稿不应提前生成馆员评语。",
      status: 502,
      retryable: true,
      details: { reason: "CURATOR_GENERATED_BEFORE_FINALIZATION" }
    });
  }
  if (
    output.status !== "needs_user_input" ||
    !["base_polished", "restyled"].includes(output.draft_stage) ||
    output.revision_state !== "awaiting_direction"
  ) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "可编辑草稿的流程状态不完整。",
      status: 502,
      retryable: true,
      details: { reason: "DRAFT_STATE_INVALID" }
    });
  }
  const actionIds = Array.isArray(output.post_draft_actions)
    ? output.post_draft_actions.map((action) => action?.id)
    : [];
  const expectedActions = [
    "continue_supplement",
    "ask_more",
    "keep_draft",
    "adjust_style",
    "custom_style"
  ];
  if (
    actionIds.length !== expectedActions.length ||
    expectedActions.some((action) => !actionIds.includes(action))
  ) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "可编辑草稿缺少后续操作。",
      status: 502,
      retryable: true,
      details: { reason: "DRAFT_ACTIONS_INVALID" }
    });
  }
  if (
    !Array.isArray(output.evidence_bindings?.curator_note) ||
    output.evidence_bindings.curator_note.length !== 0
  ) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "编辑阶段不能绑定馆员评语证据。",
      status: 502,
      retryable: true,
      details: { reason: "CURATOR_BOUND_BEFORE_FINALIZATION" }
    });
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

function normalizedComparableText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[，。！？、；：,.!?;:\s“”"'（）()《》]/g, "");
}

function textBigrams(value) {
  const normalized = normalizedComparableText(value);
  if (normalized.length < 2) return new Set([normalized]);
  const pairs = new Set();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    pairs.add(normalized.slice(index, index + 2));
  }
  return pairs;
}

function textSimilarity(first, second) {
  const left = normalizedComparableText(first);
  const right = normalizedComparableText(second);
  if (!left || !right) return 0;
  if (left === right || left.includes(right) || right.includes(left)) return 1;
  const leftPairs = textBigrams(left);
  const rightPairs = textBigrams(right);
  let overlap = 0;
  for (const pair of leftPairs) {
    if (rightPairs.has(pair)) overlap += 1;
  }
  return (2 * overlap) / (leftPairs.size + rightPairs.size);
}

function curatorCandidateIssue(candidate, { route, evidenceIds, storyText }) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return "CURATOR_CANDIDATE_INVALID";
  }
  const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
  const length = Array.from(text).length;
  if (length < 8 || length > 25) return "CURATOR_LENGTH_INVALID";
  if ((text.match(/[。！？!?]/g) ?? []).length > 1) {
    return "CURATOR_MULTIPLE_SENTENCES";
  }
  if (
    PRIVATE_REFERENCE_NAMES.some((name) => text.includes(name)) ||
    /(模仿|仿写|风格参考|作家|作者)/.test(text)
  ) {
    return "CURATOR_PRIVATE_REFERENCE";
  }
  if (GENERIC_CURATOR_PATTERN.test(text)) return "CURATOR_GENERIC";
  if (textSimilarity(text, storyText) >= 0.78) {
    return "CURATOR_REPEATS_BODY";
  }
  const lensId = candidate.lens_id;
  if (!CURATOR_MOVES.has(lensId) || !ROUTE_MOVES[route]?.has(lensId)) {
    return "CURATOR_ROUTE_MOVE_MISMATCH";
  }
  if (
    !Array.isArray(candidate.evidence_ids) ||
    candidate.evidence_ids.length === 0 ||
    candidate.evidence_ids.some((id) => !evidenceIds.has(id))
  ) {
    return "CURATOR_EVIDENCE_INVALID";
  }
  if (HUMOR_DISABLED_ROUTES.has(route) && HUMOR_PATTERN.test(text)) {
    return "CURATOR_HUMOR_UNSAFE";
  }
  return null;
}

export function validateCuratorCandidates(
  output,
  { evidence = [], currentDraft = {} } = {}
) {
  assertBaseOutput(output, "finalize_memory");
  if (output.status !== "complete" || !CURATOR_ROUTES.has(output.emotion_route)) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "馆员没有选择有效的人设路线。",
      status: 502,
      retryable: true,
      details: { reason: "CURATOR_ROUTE_INVALID" }
    });
  }
  if (
    !Array.isArray(output.candidates) ||
    output.candidates.length === 0 ||
    output.candidates.length > 3
  ) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "馆员候选结果不完整。",
      status: 502,
      retryable: true,
      details: { reason: "CURATOR_CANDIDATES_MISSING" }
    });
  }

  const evidenceIds = new Set(
    evidence.map((item) => item?.id).filter(Boolean)
  );
  const issues = [];
  for (const candidate of output.candidates) {
    const issue = curatorCandidateIssue(candidate, {
      route: output.emotion_route,
      evidenceIds,
      storyText: currentDraft.story_text
    });
    if (!issue) {
      return {
        contract_version: "1.1",
        status: "complete",
        mode: "finalize_memory",
        emotion_route: output.emotion_route,
        selected_candidate: {
          text: candidate.text.trim(),
          lens_id: candidate.lens_id,
          evidence_ids: [...new Set(candidate.evidence_ids)]
        }
      };
    }
    issues.push(issue);
  }

  throw new AppError({
    code: "MODEL_OUTPUT_INVALID",
    message: "馆员评语没有通过最终质量检查。",
    status: 502,
    retryable: true,
    details: {
      reason: issues[0] ?? "CURATOR_CANDIDATE_INVALID",
      candidate_reasons: issues
    }
  });
}

export function validateFinalizedMemory(output, input = {}) {
  assertBaseOutput(output, "finalize_memory");
  for (const field of [
    "title",
    "source_line",
    "summary",
    "story_text",
    "curator_note"
  ]) {
    assertStringField(output, field);
  }
  if (
    output.status !== "complete" ||
    output.revision_state !== "finalized" ||
    !Array.isArray(output.post_draft_actions) ||
    output.post_draft_actions.length !== 0
  ) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "最终收藏状态不完整。",
      status: 502,
      retryable: true
    });
  }

  const currentDraft = input.current_draft ?? {};
  for (const field of ["title", "source_line", "summary", "story_text"]) {
    if (currentDraft[field] != null && output[field] !== currentDraft[field]) {
      throw new AppError({
        code: "MODEL_OUTPUT_INVALID",
        message: "生成馆员评语时改变了已经确认的正文。",
        status: 502,
        retryable: true,
        details: { reason: "FINALIZATION_CHANGED_DRAFT", field }
      });
    }
  }

  const evidence = Array.isArray(output.evidence) ? output.evidence : [];
  const evidenceIds = new Set(
    evidence.map((item) => item?.id).filter(Boolean)
  );
  const route = output.curator_profile?.emotion_route;
  const candidate = {
    text: output.curator_note,
    lens_id: output.curator_profile?.lens_id,
    evidence_ids: output.evidence_bindings?.curator_note
  };
  if (!CURATOR_ROUTES.has(route)) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "最终馆员路线无效。",
      status: 502,
      retryable: true
    });
  }
  const issue = curatorCandidateIssue(candidate, {
    route,
    evidenceIds,
    storyText: output.story_text
  });
  if (issue) {
    throw new AppError({
      code: "MODEL_OUTPUT_INVALID",
      message: "最终馆员评语没有通过质量检查。",
      status: 502,
      retryable: true,
      details: { reason: issue }
    });
  }
  return output;
}

export function validateComposeEvidence(output, input = {}) {
  const supplied = [
    ...allUserInputSegments(input),
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
    ...allUserInputSegments(input)
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
    ...allUserInputSegments(input)
  ];
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
    ...allUserInputSegments(input),
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
