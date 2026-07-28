# Tone reading

Read the current expression, not the user's personality. Use tone reading to
make the question, memory text, and curator note feel attentive without
pretending to know more than the user said.

## Observation order

### 1. Check boundaries first

Set `openness` to:

- `closing` when the user says “先这样”, “就这些”, “不想多说”,
  “差不多了”, “就这样收藏”, or an equivalent boundary;
- `open` when the user supplies details, invites questions, or asks to continue;
- `unsure` when the input is brief without an explicit boundary.

Never equate short input with unwillingness. A short input can be `unsure`.

### 2. Classify expression mode

- `terse`: one short, direct statement;
- `fragmented`: transcript fragments, repetitions, or incomplete phrases;
- `narrative`: connected facts with a clear sequence or relationship;
- `playful`: explicit jokes, teasing, self-mockery, or light exaggeration;
- `literary`: deliberate imagery or strongly shaped prose.

Choose the dominant mode. Preserve valuable colloquial fragments.

### 3. Classify emotional temperature

- `light`: explicitly casual, cheerful, funny, or teasing;
- `neutral`: mainly factual, with no clear emotional statement;
- `tender`: explicitly affectionate, wistful, grateful, or gently nostalgic;
- `heavy`: explicitly describes grief, breakup, death, trauma, or intense loss;
- `guarded`: explicitly avoids, minimizes, or protects emotional content.

Use `neutral` when uncertain. Do not label an ordinary dim or rainy photo as
heavy.

### 4. Select a curator emotion route

After temperature, select one route from
[curator-lenses.md](curator-lenses.md):

- `tender_daily`
- `first_heartbeat`
- `intimate_tension`
- `family_old_days`
- `friendship_complicity`
- `bright_delight`
- `absurd_self_mockery`
- `nostalgia_change`
- `regret_parting`
- `grief_loss`
- `endurance_afterward`
- `neutral_sparse`

This is a content route, not a diagnosis. Base personal routes on E1 only. When
the input is ambiguous or image-only, use `neutral_sparse`.

### 5. Choose question tone

- `casual`: use for playful or openly conversational input;
- `concrete`: use for terse, fragmented, or abstract input;
- `gentle`: use for tender input that remains open;
- `restrained`: use for heavy, guarded, or closing input.

## Mirroring rules

- Match emotional intensity, not exact slang or punctuation.
- Ask no more intimately than the user has already spoken.
- Keep a playful user's humor natural; do not turn it into a punchline.
- Keep a tender user's warmth concrete; do not intensify it into tragedy.
- Keep a heavy user's question optional and specific; do not ask for causes or
  lessons.
- Pull literary input toward a real detail with a plain question.
- When `openness` is `closing`, ask only if the user has not explicitly opted
  out; use a low-pressure concrete question with an obvious skip action.

## Tone and writing

Apply the same profile across the flow:

- A playful question should not lead to a sentimental body.
- A restrained body should not end with a grand, uplifting curator note.
- A post-draft body style must not override `source_line` or the curator emotion
  route.
- A terse user can receive polished prose, but the prose must not become a
  different social voice.
- User-requested style affects diction only after the default-polished draft,
  evidence, and tone safety.

## Good and bad examples

Input: “朋友送的，丑得很好笑，我居然用了三年。”

- Profile: `narrative`, `light`, `open`, `casual`
- Good question: “它后来有没有哪一次，丑得特别派上用场？”
- Bad question: “它承载了你们怎样深厚的友情？”

Input: “离职那天带走的。先写这些吧。”

- Profile: `terse`, `guarded`, `closing`, `restrained`
- Action: do not ask
- Bad question: “那段经历为什么让你这么难过？”

Input: “一张海边的照片。”

- Profile: `terse`, `neutral`, `unsure`, `concrete`
- Good question: “如果愿意补一句，这张照片里你最想留下的是哪一部分？”
- Bad question: “这是你人生新阶段的开始吗？”

## Do not expose a profile guess

Return `tone_profile` when the contract requires it. Do not return speculative
sentences such as “用户是一个需要低压力引导的人”. Do not use tone labels to
infer age, identity, diagnosis, or stable preference.
