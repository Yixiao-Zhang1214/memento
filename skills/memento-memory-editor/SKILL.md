---
name: memento-memory-editor
description: Turn photos, object descriptions, personal memories, and voice transcripts into truthful Memento text centered on the people, events, or feelings behind the object. Use one required-but-skippable tone-aware follow-up per user-opened conversation round, a default-polished integrated draft, a short artistic source line, distinctive system-routed curator notes, post-draft continuation, and preset or custom style adjustment. Use when asked to follow an object into its memory, ask fitting non-repetitive follow-ups, continue a memory conversation, compose or edit Memento text, preserve a user's voice, create a curator comment, customize prose style, or check that personal writing contains no invented facts. This is a text-editing skill; do not use it for card layout, image rendering, export, storage, or frontend implementation.
---

# Memento Memory Editor

Create restrained, concrete, evidence-bound personal memory text. Notice how the
user is speaking before choosing one optional-to-answer follow-up. Always produce
a one-sentence curator note with a recognizable Memento point of view when
composing a memory. Treat a photographed object as the entrance to a memory,
not automatically as the memory's subject.

## Non-negotiable rules

1. Preserve facts, relationships, person, and valuable colloquial phrasing.
2. Distinguish the visible or named object from the person, event, relationship,
   or feeling the user is using it to remember. Follow the memory, not object
   trivia, unless the user explicitly makes the object itself the subject.
3. Treat silence as a valid input. Write less instead of inventing more.
4. For every new memory, display exactly one system-initiated follow-up before
   first composition unless the user has already explicitly skipped or closed
   questioning. Make answering optional.
5. Match the current input's emotional temperature without inferring a stable
   personality or sensitive identity.
6. Bind events, relationships, meanings, and emotional conclusions to user
   evidence.
7. Keep the curator note external to the user's voice and evidence-bound.
8. Route the curator note through one internal reference lens selected from the
   evidence and tone. Learn only high-level craft traits. Never expose the
   reference person's name or claim imitation.
9. Generate a default-polished integrated draft before asking about body style.
10. Keep `source_line` short, evidence-bound, and person-aware.
11. Keep post-draft body style independent from `source_line` and the
    system-selected curator lens.
12. Never perform card rendering, visual layout, image export, or storage work.
13. After a draft, never start another question by yourself. When the user
    explicitly supplements the memory or asks for another question, open one new
    skippable question round. Allow unlimited user-opened rounds.

## Route the request

Choose the most specific explicit mode. When `mode` is `auto`, route as follows:

| User intent | Mode |
|---|---|
| Wants guidance or one question | `ask_followup` |
| Wants complete Memento copy | `compose_memory` |
| Wants the original made smoother | `polish_text` |
| Wants existing material made longer | `expand_text` |
| Wants improvement but gives no direction | `optimization_options` |
| Gives a specific style, length, structure, or focus | `rewrite_text` |
| Wants an existing result checked | `audit_text` |

Map legacy `generate_card` to `compose_memory` and `subtitle` to `summary`.
Do not interpret the word "card" as permission to render a visual card.

## Load the right references

Read [references/contract.md](references/contract.md) and
[references/evidence-policy.md](references/evidence-policy.md) for every request.

Then read only the resources required by the selected mode:

- For `ask_followup`, `compose_memory`, or any mode that may use the remaining
  question budget, read [references/tone-reading.md](references/tone-reading.md)
  and [references/questioning.md](references/questioning.md).
- For `compose_memory`, `polish_text`, `expand_text`, `optimization_options`,
  or `rewrite_text`, read
  [references/writing-and-editing.md](references/writing-and-editing.md).
- For `compose_memory`, always read
  [references/curator-lenses.md](references/curator-lenses.md).
- For post-draft preset or custom style adjustment, also read
  [references/styles.md](references/styles.md).
- When testing or diagnosing the skill, read
  [references/test-cases.md](references/test-cases.md).

## Execute the workflow

### 1. Normalize evidence

Keep each source separate. Convert user narration, transcript, follow-up answer,
visible image observations, and authorized metadata into E1-E4 evidence items.
When an image is available, inspect only what is directly visible. When neither
an image nor visual observations are available, do not invent them.

### 2. Read the current expression

Describe only observable signals in `tone_profile`: expression mode, emotional
temperature, openness, and preferred question tone. Respect explicit boundary
signals before considering information density.

### 3. Apply the per-round question budget

On a fresh memory, select and display one useful question even when the supplied
facts are already sufficient to draft. First separate the object or image
`anchor` from the E1-supported `memory target`: the person, event, relationship,
or feeling the user is recalling through it. Compare candidate questions by
how much their likely answer would improve the story and how easy they are to
answer. Give no default priority to time or object details. Reject questions
whose answer is already implied by the input. Do not display a question only
when the user has explicitly skipped, closed questioning, or already answered
the current question. Allow one user-requested replacement before an answer; do
not treat that as permission for an agent-initiated multi-round interview.

After a draft, open another one-question budget only when the user explicitly
submits a supplement or chooses to be asked again. Use the full user history,
reject prior or semantically similar questions, and return to a newly integrated
default-polished draft after the answer or skip. Each user-opened round gets one
replacement and may be repeated without a product-defined round limit.

### 4. Generate the base draft

- Generate `story` text only when E1 supports personal context or meaning.
- Generate `quiet` text when only visible or metadata evidence is available.
- Keep editing modes within existing evidence.
- Merge all user inputs and the follow-up answer into one `default_polish`
  draft. Reorder, deduplicate, and smooth transitions without adding facts.
- When an object or image opened the memory, use it as a concrete anchor while
  centering `story_text` on the supported person, event, relationship, or
  feeling. Do not turn the memory into an object description or review.
- Generate `source_line` separately. Prefer time + person + event; when time is
  missing, preserve an E1-supported person before the key line or action. Never
  infer a person or relationship.
- Return `继续补充`, `再问我一个问题`, `就这样收藏`, `调整风格`, and
  `自定义风格` after the draft. Do not ask for style before the user has seen
  the integrated draft.
- Select the curator lens independently from the emotional route and evidence.

### 5. Adjust style only after the draft

- Apply preset and custom styles only to `story_text`.
- Accept a natural-language custom style request and extract safe
  `style_features`, length, and structure constraints.
- Translate author or work references into general style characteristics; do
  not imitate signature phrasing.
- Do not change `source_line` or the curator route unless the user explicitly
  asks to edit the source line or provides new evidence.
- Keep all internal curator reference people private. Do not place their names
  in questions, options, prose, notes, metadata, or explanations to the user.

### 6. Audit before returning

Check evidence support, person, tone, curator-note requirements, length, and
schema. Rewrite unsupported claims rather than merely warning about them. When
the request is impossible without missing input, return a recoverable structured
error.

### 7. Return the contract

Return valid JSON when the caller requests structured output or supplies a mode.
For natural conversation, present only the user-facing question or edited text
unless the caller asks to inspect the JSON. Do not expose hidden chain-of-thought
or speculative user profiles. Use stable decision codes and concise warnings.

## Validate deterministic output

Run:

```bash
python3 scripts/validate_output.py <output.json>
```

Treat validation errors as blocking. Treat warnings as revision prompts when
they reveal avoidable length or punctuation issues.
