# Writing and editing

## Contents

1. Compose a memory
2. Write the curator note
3. Preserve voice
4. Edit existing text
5. Audit prose

## 1. Compose a memory

Choose `story` only when E1 supports personal context, an event, a relationship,
or significance. Otherwise choose `quiet`.

### Story text

- Title: default 4-18 Chinese characters.
- Summary: default 12-36 Chinese characters.
- Body: default 120-260 Chinese characters.
- Curator note: default 20-45 Chinese characters and one sentence.

Use concrete supplied details before abstract conclusions. Build a short,
coherent account rather than concatenating source fields.

### Quiet text

- Use E2/E3 only.
- Describe what is visible and the fact that this moment was kept.
- Keep the body to roughly 30-90 Chinese characters.
- Do not use first-person experience, relationship, or emotional conclusions.
- Still write a one-sentence curator note with low interpretive intensity.

## 2. Write the curator note

Treat `curator_note` as a required editorial field, not a summary.

Write from a warm external observer's perspective:

- React to the meaning the user supplied rather than repeating the body.
- Follow the user's emotional temperature and expression mode.
- Use “你” only as an observer; never impersonate the user's “我”.
- Avoid praise, diagnosis, advice, moral lessons, and automatic uplift.
- Avoid universal themes such as growth, healing, companionship, and farewell
  unless E1 supports them.
- For quiet text, comment only on the visible moment or the act of keeping it.
- Keep it to one sentence.

Examples:

User evidence: “第一份工作时买的杯子，留下来是想记得自己也撑过来了。”

Curator note: “它留下的不是那些加班的夜晚，而是你第一次确认自己能够撑过去。”

Photo-only evidence: sea at dusk.

Curator note: “它没有解释那天发生了什么，只替你把黄昏留了下来。”

Playful evidence: “朋友送的，丑得很好笑，我居然用了三年。”

Curator note: “审美没有说服你，耐用倒是悄悄赢了三年。”

## 3. Preserve voice

- Preserve first, second, or third person from the source.
- Do not change a young, fragmented, or colloquial voice into a formal memoir.
- Keep memorable spoken phrases when they carry the user's attitude.
- Remove filler and transcription noise without sanitizing personality.
- Do not turn ordinary memories into brand copy or lyrical essays.
- Prefer specific nouns and verbs to adjective stacks.
- Avoid phrases such as “意义非凡”, “承载着无数回忆”,
  “独一无二的人生旅程”, and “岁月的见证”.

Apply this priority:

1. Evidence and factual boundaries
2. Explicit user editing request
3. Current tone profile
4. Selected default style

## 4. Edit existing text

### `polish_text`

- Keep roughly the original length.
- Adjust order, repetition, transitions, and rhythm.
- Preserve person, facts, relationships, and valuable colloquial wording.
- Return `polished_text` and an `edit_note` of at most 30 Chinese characters.

### `expand_text`

- Expand only existing details and their explicit implications.
- Default to roughly 1.5-2.5 times the original length.
- Do not add people, places, dates, dialogue, weather, action, brands, or
  psychological conclusions.
- Use the remaining question budget only if a single answer is essential.
- If the budget is closed, write a shorter expansion or return a recoverable
  evidence-gap warning.

### `optimization_options`

- Use when improvement is requested but direction is unclear.
- Return 3-5 materially different options.
- Always include `light_polish`.
- Describe the change, not just a mood label.
- Use options such as `detail_expand`, `emotion_focus`, `structure_rebuild`,
  `memory_ready`, `plain_young_voice`, or `quiet_literary` only when compatible
  with the source.

### `rewrite_text`

- Follow explicit length, structure, focus, and style requirements.
- Return the extracted `style_features`.
- Preserve facts and person.
- Translate named-author references into general characteristics such as plain
  diction, short sentences, restraint, everyday detail, or dry humor.
- Do not reproduce signature phrasing or claim exact imitation.
- If the request requires unknown facts, narrow the rewrite or use the one
  remaining follow-up.

## 5. Audit prose

Before returning any generated or edited text:

1. List personal claims and bind them to E1.
2. Bind visual descriptions to E2 and metadata to E3.
3. Confirm style choices only change expression.
4. Confirm person has not changed without instruction.
5. Confirm the curator note exists for `compose_memory`, is one sentence, and
   does not repeat the body.
6. Remove unsupported facts and generic AI uplift.
7. Check that length follows the user's request or default.
8. Return `audit.passed: true` only after repair.
