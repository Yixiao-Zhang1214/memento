const screens = {
  input: document.querySelector("#inputScreen"),
  question: document.querySelector("#questionScreen"),
  draft: document.querySelector("#draftScreen"),
  style: document.querySelector("#styleScreen"),
  custom: document.querySelector("#customStyleScreen"),
  final: document.querySelector("#finalScreen")
};

const elements = {
  flowLabel: document.querySelector("#flowLabel"),
  headerBackButton: document.querySelector("#headerBackButton"),
  errorBanner: document.querySelector("#errorBanner"),
  errorMessage: document.querySelector("#errorMessage"),
  retryButton: document.querySelector("#retryButton"),
  loadingLayer: document.querySelector("#loadingLayer"),
  loadingText: document.querySelector("#loadingText"),
  memoryForm: document.querySelector("#memoryForm"),
  imageInput: document.querySelector("#imageInput"),
  imagePreview: document.querySelector("#imagePreview"),
  imageEmpty: document.querySelector("#imageEmpty"),
  removeImageButton: document.querySelector("#removeImageButton"),
  rawTextInput: document.querySelector("#rawTextInput"),
  questionText: document.querySelector("#questionText"),
  answerForm: document.querySelector("#answerForm"),
  answerInput: document.querySelector("#answerInput"),
  replaceQuestionButton: document.querySelector("#replaceQuestionButton"),
  composeNowButton: document.querySelector("#composeNowButton"),
  draftSource: document.querySelector("#draftSource"),
  draftTitle: document.querySelector("#draftTitle"),
  draftSummary: document.querySelector("#draftSummary"),
  draftStory: document.querySelector("#draftStory"),
  draftCurator: document.querySelector("#draftCurator"),
  keepDraftButton: document.querySelector("#keepDraftButton"),
  adjustStyleButton: document.querySelector("#adjustStyleButton"),
  customStyleButton: document.querySelector("#customStyleButton"),
  openCustomStyleButton: document.querySelector("#openCustomStyleButton"),
  customStyleForm: document.querySelector("#customStyleForm"),
  customStyleInput: document.querySelector("#customStyleInput"),
  finalTitle: document.querySelector("#finalTitle"),
  finalSource: document.querySelector("#finalSource"),
  finalStory: document.querySelector("#finalStory"),
  finalCurator: document.querySelector("#finalCurator"),
  newMemoryButton: document.querySelector("#newMemoryButton")
};

const initialQuestionState = () => ({
  asked: false,
  replaced: false,
  answered: false,
  closed: false,
  previous_intent: null
});

const initialDraftState = () => ({
  base_draft_generated: false,
  revision_state: "not_started",
  selected_preset: null,
  custom_style_request: null
});

const state = {
  screen: "input",
  previousScreen: null,
  imageFile: null,
  imagePayload: null,
  imageObjectUrl: null,
  rawText: "",
  visualEvidence: [],
  question: null,
  questionIntent: null,
  followUpAnswer: "",
  questionState: initialQuestionState(),
  draftState: initialDraftState(),
  draft: null,
  lastRetry: null,
  busy: false
};

const screenMeta = {
  input: ["新建记忆", false],
  question: ["补充一句", true],
  draft: ["默认成稿", false],
  style: ["调整风格", true],
  custom: ["自定义风格", true],
  final: ["文字定稿", false]
};

function showScreen(name, { remember = true } = {}) {
  if (remember && state.screen !== name) {
    state.previousScreen = state.screen;
  }
  state.screen = name;

  for (const [screenName, screen] of Object.entries(screens)) {
    const active = screenName === name;
    screen.hidden = !active;
    screen.classList.toggle("is-active", active);
  }

  const [label, canGoBack] = screenMeta[name];
  elements.flowLabel.textContent = label;
  elements.headerBackButton.hidden = !canGoBack;
  document.querySelector(".screen-stack").scrollTo({ top: 0, behavior: "smooth" });
}

function setBusy(busy, message = "正在整理这段记忆") {
  state.busy = busy;
  elements.loadingText.textContent = message;
  elements.loadingLayer.hidden = !busy;
  document
    .querySelectorAll("button, textarea, input")
    .forEach((control) => {
      control.disabled = busy;
    });
}

function hideError() {
  elements.errorBanner.hidden = true;
  elements.errorMessage.textContent = "";
}

function showError(message, retry) {
  state.lastRetry = retry ?? null;
  elements.errorMessage.textContent = message;
  elements.retryButton.hidden = !retry;
  elements.errorBanner.hidden = false;
}

async function apiRequest(payload, { loadingText, retry }) {
  hideError();
  setBusy(true, loadingText);
  try {
    const response = await fetch("/api/memento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.error?.message ?? "这次整理没有完成，请稍后再试。");
    }
    return result;
  } catch (error) {
    showError(error.message, retry);
    return null;
  } finally {
    setBusy(false);
  }
}

function fileToPayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const commaIndex = dataUrl.indexOf(",");
      if (commaIndex < 0) {
        reject(new Error("图片内容无法读取，请重新选择。"));
        return;
      }
      resolve({
        mime_type: file.type,
        data_base64: dataUrl.slice(commaIndex + 1)
      });
    };
    reader.onerror = () => reject(new Error("图片内容无法读取，请重新选择。"));
    reader.readAsDataURL(file);
  });
}

function visualEvidenceFrom(result) {
  return Array.isArray(result?.evidence)
    ? result.evidence
        .filter((item) => item?.level === "E2")
        .map((item) => item.content)
        .filter(Boolean)
    : state.visualEvidence;
}

function basePayload() {
  return {
    contract_version: "1.1",
    image: state.imagePayload,
    visual_evidence: state.visualEvidence,
    raw_text: state.rawText,
    transcript_text: "",
    follow_up_question: state.question,
    follow_up_answer: state.followUpAnswer,
    user_skipped: false,
    question_state: state.questionState,
    style: null,
    draft_state: state.draftState,
    rewrite_request: null,
    target_length: null,
    existing_text: null
  };
}

function acceptFollowup(result) {
  state.imagePayload = null;
  state.visualEvidence = visualEvidenceFrom(result);
  state.question = result.question;
  state.questionIntent = result.question_intent;
  state.questionState = {
    ...state.questionState,
    asked: true,
    previous_intent: result.question_intent
  };
  elements.questionText.textContent = result.question;
  elements.replaceQuestionButton.hidden = state.questionState.replaced;
  elements.answerInput.value = "";
  showScreen("question");
}

function renderDraft(draft) {
  state.draft = draft;
  state.imagePayload = null;
  state.visualEvidence = visualEvidenceFrom(draft);
  state.draftState = {
    ...state.draftState,
    base_draft_generated: true,
    revision_state: draft.revision_state ?? "awaiting_direction"
  };
  elements.draftSource.textContent = draft.source_line;
  elements.draftTitle.textContent = draft.title;
  elements.draftSummary.textContent = draft.summary;
  elements.draftStory.textContent = draft.story_text;
  elements.draftCurator.textContent = draft.curator_note;
  showScreen("draft");
}

async function beginMemory() {
  state.rawText = elements.rawTextInput.value.trim();
  if (!state.rawText && !state.imageFile) {
    showError("请添加一张图片或写下一点内容。");
    return;
  }

  if (state.imageFile && !state.imagePayload) {
    try {
      state.imagePayload = await fileToPayload(state.imageFile);
    } catch (error) {
      showError(error.message);
      return;
    }
  }

  const run = () => beginMemory();
  const result = await apiRequest(
    { ...basePayload(), mode: "auto" },
    { loadingText: "正在读这件东西背后的线索", retry: run }
  );
  if (!result) return;
  if (result.mode === "ask_followup") {
    acceptFollowup(result);
  } else {
    renderDraft(result);
  }
}

async function replaceQuestion() {
  const nextQuestionState = {
    ...state.questionState,
    asked: true,
    replaced: true,
    previous_intent: state.questionIntent
  };
  const run = () => replaceQuestion();
  const result = await apiRequest(
    {
      ...basePayload(),
      mode: "ask_followup",
      question_state: nextQuestionState
    },
    { loadingText: "正在换一个更合适的问题", retry: run }
  );
  if (!result) return;
  state.questionState = nextQuestionState;
  acceptFollowup(result);
}

async function composeMemory({ answer = "", skipped = false } = {}) {
  state.followUpAnswer = answer.trim();
  const nextQuestionState = {
    ...state.questionState,
    asked: true,
    answered: Boolean(state.followUpAnswer),
    closed: true
  };
  const run = () => composeMemory({ answer, skipped });
  const result = await apiRequest(
    {
      ...basePayload(),
      mode: "compose_memory",
      follow_up_answer: state.followUpAnswer,
      user_skipped: skipped,
      question_state: nextQuestionState
    },
    { loadingText: "正在把这些话整理成一段记忆", retry: run }
  );
  if (!result) return;
  state.questionState = nextQuestionState;
  renderDraft(result);
}

async function rewriteDraft({ style = null, customRequest = null } = {}) {
  const nextDraftState = {
    ...state.draftState,
    revision_state: "in_progress",
    selected_preset: style,
    custom_style_request: customRequest
  };
  const run = () => rewriteDraft({ style, customRequest });
  const result = await apiRequest(
    {
      ...basePayload(),
      mode: "rewrite_text",
      current_draft: state.draft,
      style,
      draft_state: nextDraftState,
      rewrite_request: customRequest
    },
    { loadingText: "正在调整正文的表达", retry: run }
  );
  if (!result) return;
  state.draftState = {
    ...nextDraftState,
    revision_state: "awaiting_direction"
  };
  renderDraft(result);
}

function finalizeDraft() {
  if (!state.draft) return;
  elements.finalTitle.textContent = state.draft.title;
  elements.finalSource.textContent = state.draft.source_line;
  elements.finalStory.textContent = state.draft.story_text;
  elements.finalCurator.textContent = state.draft.curator_note;
  state.draftState.revision_state = "finalized";
  showScreen("final");
}

function resetApp() {
  if (state.imageObjectUrl) {
    URL.revokeObjectURL(state.imageObjectUrl);
  }
  Object.assign(state, {
    screen: "input",
    previousScreen: null,
    imageFile: null,
    imagePayload: null,
    imageObjectUrl: null,
    rawText: "",
    visualEvidence: [],
    question: null,
    questionIntent: null,
    followUpAnswer: "",
    questionState: initialQuestionState(),
    draftState: initialDraftState(),
    draft: null,
    lastRetry: null,
    busy: false
  });
  elements.memoryForm.reset();
  elements.answerForm.reset();
  elements.customStyleForm.reset();
  elements.imagePreview.hidden = true;
  elements.imagePreview.removeAttribute("src");
  elements.imageEmpty.hidden = false;
  elements.removeImageButton.hidden = true;
  hideError();
  showScreen("input", { remember: false });
}

elements.imageInput.addEventListener("change", () => {
  const [file] = elements.imageInput.files;
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    elements.imageInput.value = "";
    showError("目前支持 JPEG、PNG 和 WebP 图片。");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    elements.imageInput.value = "";
    showError("图片不能超过 10 MB。");
    return;
  }

  if (state.imageObjectUrl) URL.revokeObjectURL(state.imageObjectUrl);
  state.imageFile = file;
  state.imagePayload = null;
  state.imageObjectUrl = URL.createObjectURL(file);
  elements.imagePreview.src = state.imageObjectUrl;
  elements.imagePreview.hidden = false;
  elements.imageEmpty.hidden = true;
  elements.removeImageButton.hidden = false;
  hideError();
});

elements.removeImageButton.addEventListener("click", () => {
  if (state.imageObjectUrl) URL.revokeObjectURL(state.imageObjectUrl);
  state.imageFile = null;
  state.imagePayload = null;
  state.imageObjectUrl = null;
  elements.imageInput.value = "";
  elements.imagePreview.hidden = true;
  elements.imagePreview.removeAttribute("src");
  elements.imageEmpty.hidden = false;
  elements.removeImageButton.hidden = true;
});

elements.memoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  beginMemory();
});

elements.answerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const answer = elements.answerInput.value.trim();
  if (!answer) {
    showError("写下一句话，或者选择“就这样收藏”。");
    return;
  }
  composeMemory({ answer });
});

elements.replaceQuestionButton.addEventListener("click", replaceQuestion);
elements.composeNowButton.addEventListener("click", () =>
  composeMemory({ skipped: true })
);
elements.keepDraftButton.addEventListener("click", finalizeDraft);
elements.adjustStyleButton.addEventListener("click", () => showScreen("style"));
elements.customStyleButton.addEventListener("click", () =>
  showScreen("custom")
);
elements.openCustomStyleButton.addEventListener("click", () =>
  showScreen("custom")
);

document.querySelectorAll(".style-option").forEach((button) => {
  button.addEventListener("click", () =>
    rewriteDraft({ style: button.dataset.style })
  );
});

elements.customStyleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const request = elements.customStyleInput.value.trim();
  if (!request) {
    showError("请写下你希望正文怎么调整。");
    return;
  }
  rewriteDraft({ customRequest: request });
});

elements.headerBackButton.addEventListener("click", () => {
  if (state.screen === "style" || state.screen === "custom") {
    showScreen("draft", { remember: false });
    return;
  }
  if (state.screen === "question") {
    state.question = null;
    state.questionIntent = null;
    state.followUpAnswer = "";
    state.questionState = initialQuestionState();
    showScreen("input", { remember: false });
  }
});

elements.retryButton.addEventListener("click", () => {
  const retry = state.lastRetry;
  hideError();
  retry?.();
});

elements.newMemoryButton.addEventListener("click", resetApp);
