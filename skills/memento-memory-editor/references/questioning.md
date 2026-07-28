# Questioning

## Global question budget

- For each fresh memory, display exactly one system-initiated question before
  first composition.
- The user never has to answer it.
- Allow one user-requested replacement before the user answers.
- Treat replacement as changing the active question, not starting an interview.
- Close the budget after an answer, a skip, “就这样收藏”, or any boundary signal.
- After closure, shorten the output or describe the missing evidence. Never ask
  again from an editing mode.

## Decide what to ask

Use this order:

1. If `user_skipped` is true, return `USER_SKIPPED`.
2. If the question state is closed or answered, return
   `QUESTION_BUDGET_CLOSED`.
3. If the user's input itself explicitly says “不想回答”, “不要问了”,
   “就这样收藏”, or an equivalent opt-out, return `BOUNDARY_CLOSING`.
4. Generate up to three candidate questions for the single most useful
   remaining gap, even when existing evidence is sufficient to draft.
5. Reject leading, repetitive, private, double, or low-value candidates.
6. Ask the highest-scoring safe candidate. If a deep question would be
   invasive, fall back to a concrete or choice probe rather than skipping the
   question.
7. Use `NO_SAFE_HIGH_VALUE_QUESTION` only when every possible question would
   violate evidence, privacy, or safety constraints.

## Question intents

### `scene_probe`

Use when a concrete scene would ground an abstract or minimal account.

Example: “如果只补一个画面，你最先想到它出现在哪里？”

### `sensory_probe`

Use only when the user is already describing a scene and a remembered sensory
detail would help. Do not demand invented atmosphere.

Example: “那个画面里，你还记得最清楚的是一种声音，还是一个动作？”

### `moment_probe`

Use when an item is known but its relevant moment is missing.

Example: “它最像是把哪一次使用留了下来？”

### `contrast_probe`

Use when the user explicitly mentions past/present, before/after, getting/
losing, or continued use.

Example: “刚得到它和现在再看它，最不一样的是什么？”

### `aftertrace_probe`

Use for flowers, food, tickets, notes, packaging, or anything that may disappear.

Example: “它后来留下来的，是照片、一个动作，还是这件事本身？”

Do not assume the physical item survives.

### `significance_probe`

Use only when the user is open and has already started explaining personal
meaning.

Example: “你为什么一直想把这件事留到现在？”

Do not use “这对你意味着什么” as the default.

### `future_probe`

Use when facts are sufficient but the user explicitly wants a more reflective
ending.

Example: “以后再看到这段文字时，你最想先记起哪一点？”

### `choice_probe`

Use when the user does not know how to begin. Offer neutral, evidence-compatible
choices.

Example: “你更想留下它本身的样子，还是当时发生的一件小事？”

Do not offer emotionally loaded choices such as “一个人、一段时光、一次告别”
unless those themes are already E1 evidence.

## Candidate scoring

Score each candidate from 0-2:

- information gain;
- ease of answering;
- fit with current tone;
- value to the final text.

Apply a blocking rejection for:

- leading emotion or relationship;
- sensitive or unnecessary private detail;
- repeating known information;
- more than one independent request;
- pure trivia with no writing value;
- contradiction with user correction;
- assumption that a perishable item still exists.

Prefer a non-rejected candidate scoring at least 6/8. If none reaches 6, ask the
best safe concrete or choice probe scoring at least 4/8. Do not ask merely to
collect trivia.

## Follow the tone

- `casual`: use natural spoken Chinese; allow light humor already present.
- `concrete`: ask for one visible or remembered detail.
- `gentle`: use a soft but direct sentence; avoid therapeutic language.
- `restrained`: ask one non-invasive, concrete question and make the skip action
  especially easy to see.

## Handle user actions

- Text or voice answer: absorb the answer and compose; do not ask another
  question. Do not expose an answer button.
- `换一个问题`: choose a different intent, mark `replaced: true`, and replace
  the active question once.
- `就这样收藏`: close the budget and compose from current evidence.
- Free addition: absorb it as E1 and compose unless the user explicitly asks
  only for editing.

Return action objects with stable IDs:

- `replace_question` with label `换一个问题`;
- `compose_now` with label `就这样收藏`.

After the one allowed replacement, return only `compose_now`.

## Validate the question

Before returning:

- ensure one information request;
- use at most one question mark;
- make the expected answer obvious;
- avoid “请讲讲” and coaching language;
- avoid “一定”, “是不是很”, and unsupported emotional framing;
- ensure the user can skip;
- return a decision code, not hidden reasoning.
