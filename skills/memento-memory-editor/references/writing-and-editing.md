# Writing and editing

## Contents

1. Compose a memory
2. Write the source line
3. Write the curator note
4. Preserve voice
5. Adjust style after drafting
6. Edit existing text
7. Audit prose

## 1. Compose a memory

Choose `story` only when E1 supports personal context, an event, a relationship,
or significance. Otherwise choose `quiet`.

Always generate the first integrated result with `default_polish` before asking
about style:

- merge raw text, transcript text, and the follow-up answer;
- order supplied facts into a coherent sequence;
- remove repetition, filler, and transcription noise;
- add only necessary transitions;
- preserve valuable spoken wording, dialogue, person, and emotional
  temperature;
- do not introduce the diction or structure of a preset style.

### Story text

- Title: default 4-18 Chinese characters.
- Source line: default 4-18 Chinese characters.
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

## 2. Write the source line

Treat `source_line` as a required field outside `story_text`.

- Prefer time + person + event when E1/E3 support all three.
- When time is missing, retain an E1-supported person before a key line, action,
  or event.
- When no person is supported, use the object or event without inferring a
  relationship.
- Keep it fragment-like and lightly artistic; avoid a full explanatory
  sentence.
- Bind every personal or temporal element to E1/E3.
- Do not let post-draft body style change it unless the user explicitly asks to
  edit the source line.

Examples:

- `2024年春，他的告白`
- `他的一句“愿不愿意”`
- `第一份工作，那些夜晚`
- `镜头里的一束花`

Avoid:

- `男朋友在告白那天送给我的一束花`
- `一段珍贵而浪漫的爱情回忆`
- any date, season, person, or relationship absent from evidence.

## 3. Write the curator note

Treat `curator_note` as a required editorial field, not a summary.

Read [curator-lenses.md](curator-lenses.md), choose one route from E1 evidence
and `tone_profile`, and write from the stable Memento curator perspective:

- React to the meaning the user supplied rather than repeating the body.
- Follow the user's emotional temperature and expression mode.
- Add one specific observation, contrast, or turn that is absent from the body.
- Use “你” only as an observer; never impersonate the user's “我”.
- Avoid praise, diagnosis, advice, moral lessons, and automatic uplift.
- Avoid universal themes such as growth, healing, companionship, and farewell
  unless E1 supports them.
- For quiet text, comment only on the visible moment or the act of keeping it.
- Keep it to one sentence.
- Keep the internal calibration person private. Do not name them or describe the
  result as an imitation.

Examples:

User evidence: “第一份工作时买的杯子，留下来是想记得自己也撑过来了。”

Curator note: “它留下的不是那些加班的夜晚，而是你第一次确认自己能够撑过去。”

Photo-only evidence: sea at dusk.

Curator note: “它没有解释那天发生了什么，只替你把黄昏留了下来。”

Playful evidence: “朋友送的，丑得很好笑，我居然用了三年。”

Curator note: “审美没有说服你，耐用倒是悄悄赢了三年。”

First-confession evidence: “他问我愿不愿意做他女朋友，我说好。”

Curator note: “这束花替一个冒险的问题壮了胆，又被一个‘好’留到了现在。”

## 4. Preserve voice

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
4. `default_polish` for the first draft
5. Selected post-draft style

## 5. Adjust style after drafting

Do not ask the user to choose a body style before the integrated draft exists.
After the base draft, return:

- `keep_draft` with label `就这样收藏`;
- `adjust_style` with label `调整风格`;
- `custom_style` with label `自定义风格`.

For `adjust_style`, present the five presets in
[styles.md](styles.md). For `custom_style`, accept a natural-language request
about voice, length, structure, polish, or a creator reference. Convert the
request into `style_features` and rewrite only `story_text`.

Do not reopen the factual question budget. Preserve title, `source_line`,
summary, evidence, and curator route unless the user explicitly asks to edit
those fields. Re-audit the curator note after a body rewrite and change it only
when it has become repetitive or mismatched.

## 6. Edit existing text

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

## 7. Audit prose

Before returning any generated or edited text:

1. List personal claims and bind them to E1.
2. Bind visual descriptions to E2 and metadata to E3.
3. Confirm `source_line` is evidence-bound, short, and person-aware when E1
   contains a relevant person.
4. Confirm style choices occur after the base draft and only change expression.
5. Confirm person has not changed without instruction.
6. Confirm the curator note exists for `compose_memory`, is one sentence, does
   not repeat the body, uses exactly one curator route, and exposes no internal
   reference person.
7. Remove unsupported facts and generic AI uplift.
8. Check that length follows the user's request or default.
9. Return `audit.passed: true` only after repair.
