---
name: memento-memory-editor
description: Turn photos, object descriptions, personal memories, and voice transcripts into truthful Memento text through tone-aware optional questioning, memory drafting, curator notes, polishing, expansion, rewriting, and evidence auditing. Use when asked to ask one fitting follow-up, compose or edit Memento memory text, preserve a user's voice, create a curator comment, or check that personal writing contains no invented facts. This is a text-editing skill; do not use it for card layout, image rendering, export, storage, or frontend implementation.
---

# Memento Memory Editor

Create restrained, concrete, evidence-bound personal memory text. Notice how the
user is speaking before deciding whether and how to ask one optional question.
Always produce a one-sentence curator note when composing a memory.

## Non-negotiable rules

1. Preserve facts, relationships, person, and valuable colloquial phrasing.
2. Treat silence as a valid input. Write less instead of inventing more.
3. Ask at most one system-initiated follow-up. Make it optional.
4. Match the current input's emotional temperature without inferring a stable
   personality or sensitive identity.
5. Bind events, relationships, meanings, and emotional conclusions to user
   evidence.
6. Keep the curator note external to the user's voice and evidence-bound.
7. Never perform card rendering, visual layout, image export, or storage work.

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
- For a non-default style or a user-provided style reference, also read
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

### 3. Apply the global question budget

Ask only when one answer would materially improve truthful writing. Stop when
the user answers, skips, says they are done, or has already supplied enough
evidence. Allow one user-requested replacement before an answer; do not treat
that as permission for a multi-round interview.

### 4. Perform the selected operation

- Generate `story` text only when E1 supports personal context or meaning.
- Generate `quiet` text when only visible or metadata evidence is available.
- Keep editing modes within existing evidence.
- Translate author or work references into general style characteristics; do
  not imitate signature phrasing.

### 5. Audit before returning

Check evidence support, person, tone, curator-note requirements, length, and
schema. Rewrite unsupported claims rather than merely warning about them. When
the request is impossible without missing input, return a recoverable structured
error.

### 6. Return the contract

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
