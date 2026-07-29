# Questioning

## Global question budget

- For each fresh memory, display exactly one system-initiated question before
  first composition.
- The user never has to answer it.
- Allow one user-requested replacement before the user answers.
- Treat replacement as changing the active question, not starting an interview.
- Close the budget after an answer, a skip, “就这样收藏”, or any boundary signal.
- After closure, do not ask again by yourself.
- When the user explicitly submits a supplement or requests another question
  after a draft, open a fresh one-question budget for that round.
- Allow unlimited user-opened rounds. Each round remains optional and receives
  one replacement opportunity.
- Use prior assistant questions only as context and repetition guards. Never
  treat a question as factual evidence.

## Decide what to ask

Use this order:

1. If `user_skipped` is true, return `USER_SKIPPED`.
2. If the question state is closed or answered, return
   `QUESTION_BUDGET_CLOSED`.
3. If the user's input itself explicitly says “不想回答”, “不要问了”,
   “就这样收藏”, or an equivalent opt-out, return `BOUNDARY_CLOSING`.
4. Separate the `anchor` from the `memory target`.
5. Read all prior questions and reject exact or semantically similar candidates.
6. Form a provisional draft from current evidence and identify what one answer
   could add to its person, event, relationship, or feeling.
7. Generate up to five candidate questions from different useful directions.
   Let time and object detail compete without default priority.
8. Reject leading, repetitive, private, double, low-value, or already-answered
   candidates.
9. Ask the highest-scoring safe candidate. If a deep question would be
   invasive, fall back to a concrete or choice probe rather than skipping the
   question.
10. Use `NO_SAFE_HIGH_VALUE_QUESTION` only when every possible question would
   violate evidence, privacy, or safety constraints.

## Separate the anchor from the memory target

The `anchor` is the photographed or named object that opens the memory: a bowl
of wontons, flowers, a ticket, a cup, a watch, or a dog in a photograph.

The `memory target` is what E1 is actually trying to retain or express:

- a person or relationship;
- an event or period of life;
- a repeated experience;
- a feeling already stated or signaled in the user's phrasing;
- the object itself, only when the user explicitly centers its qualities,
  making, use, or collection.

When E1 supplies context around an object, follow that context. Do not remain at
the anchor merely because it is easy to ask about.

Examples:

- “亚朵酒店的早餐味道还不错，又是出差的一天”：the breakfast is the
  anchor; the repeated business-trip experience and the feeling behind “又是”
  are the target.
- “告白那天的花”：the flowers are the anchor; the confession and relationship
  beginning are the target.
- “爸爸生前常戴的手表”：the watch is the anchor; the father and remembered
  life around him are the target.
- “专门收藏不同品牌的钢笔，最喜欢这支笔尖的反馈”：the pen itself is an
  explicit target, so an object-detail question can be useful.

Do not expose `anchor`, `memory target`, candidate questions, or scores to the
user.

## Question intents

### `time_probe`

Use when time materially clarifies chronology, life stage, or why this instance
matters among similar memories. A confession, graduation, resignation, trip,
or gift does not make time the default.

Example: “你还记得这大概是什么时候吗？”

Accept an exact date, year/month, season, relative period, or life stage such as
“去年春天”, “大学时”, or “刚工作那年”. Accept “记不清” without asking again.
Do not require exact dates, and do not ask when reliable time metadata already
exists or when the memory spans a long period.

### `scene_probe`

Use when a concrete scene would ground an abstract or minimal account.

Example: “那天有没有一件事是你到现在还记得的？”

### `sensory_probe`

Use only when the user is already describing a scene and a remembered sensory
detail would help. Do not demand invented atmosphere.

Example: “你还记得当时有什么声音吗？”

### `moment_probe`

Use when an item is known but its relevant moment is missing.

Example: “你用它的时候，有没有一件事是你一直记得的？”

### `contrast_probe`

Use when the user explicitly mentions past/present, before/after, getting/
losing, or continued use.

Example: “那时候和现在，哪里最不一样？”

### `aftertrace_probe`

Use for flowers, food, tickets, notes, packaging, or anything that may disappear.

Example: “那件事以后，你们还做了什么？”

Do not assume the physical item survives.

### `significance_probe`

Use when the user is open and has already started explaining personal meaning,
or when the user's own wording contains an important but unspecified feeling.

Example: “你为什么一直想把这件事留到现在？”

Feeling example: “你写‘又是出差的一天’时，是什么心情？”

Do not use “这对你意味着什么” as the default.

### `future_probe`

Use when facts are sufficient but the user explicitly wants a more reflective
ending.

Example: “以后再看这段话，你最想先记住哪件事？”

### `choice_probe`

Use when the user does not know how to begin. Offer neutral, evidence-compatible
choices.

Example: “你更想说说当时发生的事，还是和它有关的人？”

Do not offer emotionally loaded choices such as “一个人、一段时光、一次告别”
unless those themes are already E1 evidence.

## Candidate scoring

Score each candidate:

- contribution to the final story: 0-4;
- ease of answering, including whether a short answer works: 0-3;
- fit with current tone and openness: 0-2;
- non-redundancy with supplied or strongly implied information: 0-2.

Give no bonus to `time_probe`. Support for `source_line` counts only when time
also improves chronology, life-stage context, or the story's identity.

Give an object-detail candidate writing value only when the object itself is
the explicit memory target or the detail connects directly to the supported
person, event, or feeling. Better taste, color, material, or appearance alone
does not improve a story whose target lies behind the object.

Apply a blocking rejection for:

- leading emotion or relationship;
- sensitive or unnecessary private detail;
- repeating known information;
- more than one independent request;
- pure trivia with no writing value;
- an answer already stated or strongly implied by the input;
- a predictable generic answer such as asking what comes after breakfast when
  the user has already said it is a work trip;
- lingering on taste, appearance, or use when E1 points to a person, event, or
  feeling behind the object;
- contradiction with user correction;
- assumption that a perishable item still exists.

Choose the highest-scoring non-rejected candidate. Break ties by contribution
to the story, ease of answering, lower sensitivity, and closeness to the user's
own wording. Do not ask merely to collect trivia.

## Make the question sound human

Before returning the selected candidate:

- make the expected answer type obvious: one event, action, line, habit, reason,
  feeling, time, or place;
- ensure a short answer could be used in the eventual body;
- reuse the user's nouns and distinctive phrasing where natural;
- keep the question to one everyday sentence, preferably within 35 Chinese
  characters;
- use at most one question mark.

Reject or rewrite editorial and therapeutic prompts such as:

- “如果只留一个画面……”
- “你最先想到的是什么样子……”
- “这对你意味着什么……”
- “你最想为它留下什么……”
- “能否展开讲讲……”

When a user's own phrase carries an unstated feeling and openness is not
`closing`, ask about that phrase plainly. Example:

Input: “亚朵酒店的早餐味道还不错，又是出差的一天。”

Good: “你写‘又是出差的一天’时，是什么心情？”

Bad:

- “吃完这碗馄饨，你接下来要去做什么？” The likely answer is already
  implied by “出差”.
- “这碗馄饨是汤更好喝，还是馅儿更好吃？” It remains at the anchor and
  misses the repeated experience the user chose to mention.

## Follow the tone

- `casual`: use natural spoken Chinese; allow light humor already present.
- `concrete`: ask for one visible or remembered detail.
- `gentle`: use a soft but direct sentence; avoid therapeutic language.
- `restrained`: ask one non-invasive, concrete question and make the skip action
  especially easy to see.

## Handle user actions

- Text or voice answer: absorb the answer and generate the default-polished
  integrated draft; do not ask another factual question. Do not expose an
  answer button.
- `换一个问题`: choose a different intent, mark `replaced: true`, and replace
  the active question once.
- `就这样收藏`: close the budget and generate the default-polished draft from
  current evidence.
- Post-draft supplement: absorb it as a new E1 item, open one new optional
  question, then regenerate the default-polished draft.
- `再问我一个问题`: open one new optional question using all user history.
- After any continuation answer or skip, regenerate from all user E1 items and
  return to `base_polished`; do not preserve a prior body-style rewrite.

Return action objects with stable IDs:

- `replace_question` with label `换一个问题`;
- `compose_now` with label `就这样收藏`.

After the one allowed replacement, return only `compose_now`.

## Validate the question

Before returning:

- ensure one information request;
- use at most one question mark;
- make the expected answer obvious;
- ensure the answer is not already stated or strongly implied;
- ensure the question follows the memory target rather than defaulting to the
  photographed object;
- ensure a short answer could improve the eventual body;
- avoid “请讲讲” and coaching language;
- avoid “一定”, “是不是很”, and unsupported emotional framing;
- ensure the user can skip;
- return a decision code, not hidden reasoning.
