# Contract

## Contents

1. Version and modes
2. Input
3. Shared structures
4. Outputs
5. Errors

## 1. Version and modes

Use contract version `1.1`.

Input modes:

- `auto`
- `ask_followup`
- `compose_memory`
- `polish_text`
- `expand_text`
- `optimization_options`
- `rewrite_text`
- `audit_text`

`auto` is a router. Return the selected concrete mode in the output.

Statuses:

- `needs_user_input`
- `complete`
- `blocked`

## 2. Input

```json
{
  "contract_version": "1.1",
  "mode": "auto",
  "image_ref": null,
  "visual_evidence": [],
  "raw_text": "",
  "transcript_text": "",
  "follow_up_question": null,
  "follow_up_answer": "",
  "user_skipped": false,
  "question_state": {
    "asked": false,
    "replaced": false,
    "answered": false,
    "closed": false,
    "previous_intent": null
  },
  "style": null,
  "draft_state": {
    "base_draft_generated": false,
    "revision_state": "not_started",
    "selected_preset": null,
    "custom_style_request": null
  },
  "rewrite_request": null,
  "target_length": null,
  "existing_text": null
}
```

Rules:

- Treat `image_ref` as opaque. Inspect it only when the runtime can access it.
- Prefer supplied `visual_evidence` over repeating image inspection.
- Preserve the separate provenance of all text fields.
- Treat missing optional fields as empty or null.
- Treat a missing `style` as `default_polish`, not as a request to choose a
  style before drafting.
- Accept `style` only for a post-draft preset adjustment. Accept
  `custom_style_request` as natural-language E4 evidence.
- Return a structured error when the selected mode lacks required input.

## 3. Shared structures

Evidence:

```json
{
  "id": "E1-01",
  "level": "E1",
  "source": "raw_text",
  "content": "这是我第一份工作时买的杯子",
  "allowed_uses": [
    "title",
    "source_line",
    "summary",
    "story_text",
    "curator_note"
  ]
}
```

Tone profile:

```json
{
  "expression_mode": "terse",
  "emotional_temperature": "neutral",
  "openness": "unsure",
  "preferred_question_tone": "concrete",
  "curator_emotion_route": "neutral_sparse"
}
```

Allowed tone values:

- `expression_mode`: `terse`, `fragmented`, `narrative`, `playful`, `literary`
- `emotional_temperature`: `light`, `neutral`, `tender`, `heavy`, `guarded`
- `openness`: `open`, `unsure`, `closing`
- `preferred_question_tone`: `casual`, `concrete`, `gentle`, `restrained`
- `curator_emotion_route`: `tender_daily`, `first_heartbeat`,
  `intimate_tension`, `family_old_days`, `friendship_complicity`,
  `bright_delight`, `absurd_self_mockery`, `nostalgia_change`,
  `regret_parting`, `grief_loss`, `endurance_afterward`, `neutral_sparse`

## 4. Outputs

### Follow-up

```json
{
  "contract_version": "1.1",
  "status": "needs_user_input",
  "mode": "ask_followup",
  "needs_followup": true,
  "evidence": [],
  "tone_profile": {},
  "question_intent": "time_probe",
  "question": "你还记得这大概是什么时候吗？",
  "user_actions": [
    {
      "id": "replace_question",
      "label": "换一个问题"
    },
    {
      "id": "compose_now",
      "label": "就这样收藏"
    }
  ],
  "decision_code": "MANDATORY_OPTIONAL_QUESTION"
}
```

Do not return an answer button. The user answers through text or voice input.
Before a replacement, return both actions. After the one allowed replacement,
omit `replace_question` and return only `compose_now`.

For a fresh memory that has not opted out, a follow-up is required even when
the evidence is already sufficient. Use decision code
`MANDATORY_OPTIONAL_QUESTION`.

When the user has already answered or explicitly skipped, set `status` to
`complete`, `needs_followup` to `false`, `question` to `null`, and use one of:

- `USER_SKIPPED`
- `BOUNDARY_CLOSING`
- `NO_SAFE_HIGH_VALUE_QUESTION`
- `QUESTION_BUDGET_CLOSED`

### Composed memory

```json
{
  "contract_version": "1.1",
  "status": "needs_user_input",
  "mode": "compose_memory",
  "draft_stage": "base_polished",
  "revision_state": "awaiting_direction",
  "text_type": "story",
  "evidence": [],
  "tone_profile": {},
  "title": "",
  "source_line": "",
  "summary": "",
  "story_text": "",
  "curator_note": "",
  "curator_profile": {
    "emotion_route": "neutral_sparse",
    "lens_id": "object_first_observation"
  },
  "evidence_bindings": {
    "title": [],
    "source_line": [],
    "summary": [],
    "story_text": [],
    "curator_note": []
  },
  "post_draft_actions": [
    {
      "id": "keep_draft",
      "label": "就这样收藏"
    },
    {
      "id": "adjust_style",
      "label": "调整风格"
    },
    {
      "id": "custom_style",
      "label": "自定义风格"
    }
  ],
  "audit": {
    "passed": true,
    "unsupported_claims": [],
    "warnings": []
  }
}
```

For the first integrated result, use `draft_stage: "base_polished"` and
`revision_state: "awaiting_direction"`. Generate it before any style selection.
Set `status` to `needs_user_input` because the user may keep or adjust it.

For a preset or custom rewrite, use `draft_stage: "restyled"` and keep
`revision_state: "awaiting_direction"` until the user chooses `keep_draft`.
When the user keeps the current draft, set `status: "complete"`,
`revision_state: "finalized"`, and return an empty `post_draft_actions` array.

`source_line` is required, should be 4-18 Chinese characters, and must remain
independent from body style. Prefer time + E1-supported person + event. If time
is absent, preserve the E1-supported person before a key line or action. If no
person is supported, use the object or event without inventing a relationship.

`curator_profile` is public-safe metadata. Never include a reference person's
name or fields such as `reference_person`, `author`, `inspired_by`, or
`style_imitation`.

### Post-draft style selection

For `adjust_style`, return the five preset body styles from
`references/styles.md`. For `custom_style`, ask:

`你想让这段正文怎么写？`

The user may describe voice, length, structure, level of polish, or a creator
reference in natural language. Treat this as E4, not as a new factual follow-up.
Return extracted `style_features` in a restyled structured response when the
caller requests JSON.

### Polish

Require `existing_text` or source text. Return:

```json
{
  "contract_version": "1.1",
  "status": "complete",
  "mode": "polish_text",
  "polished_text": "",
  "edit_note": "",
  "audit": {
    "passed": true,
    "unsupported_claims": [],
    "warnings": []
  }
}
```

### Expand

Use the polish schema with `mode: "expand_text"` and fields
`expanded_text`, `edit_note`, and `audit`.

### Optimization options

```json
{
  "contract_version": "1.1",
  "status": "needs_user_input",
  "mode": "optimization_options",
  "question": "你想把这段话往哪个方向改？",
  "options": [
    {
      "id": "light_polish",
      "label": "只顺一下",
      "description": "尽量保留原话，只调整语序和重复。"
    }
  ],
  "decision_code": "EDIT_DIRECTION_UNCLEAR"
}
```

Return 3-5 options. Include `light_polish`.

### Rewrite

Use fields `rewrite_request`, `style_features`, `rewritten_text`,
`edit_note`, and `audit`.

### Audit

```json
{
  "contract_version": "1.1",
  "status": "complete",
  "mode": "audit_text",
  "audit": {
    "passed": false,
    "unsupported_claims": [
      {
        "field": "story_text",
        "claim": "未经支持的内容",
        "repair": "删除或改写为可见事实"
      }
    ],
    "warnings": []
  }
}
```

## 5. Errors

```json
{
  "contract_version": "1.1",
  "status": "blocked",
  "mode": "expand_text",
  "error_code": "MISSING_SOURCE_TEXT",
  "message": "该编辑模式需要 existing_text 或用户原文。",
  "recoverable": true,
  "required_fields": ["existing_text"]
}
```

Use:

- `INVALID_MODE`
- `MISSING_SOURCE_TEXT`
- `MISSING_MEMORY_INPUT`
- `IMAGE_UNAVAILABLE`
- `INVALID_CONTRACT_VERSION`
- `UNSUPPORTED_STYLE`
- `EMPTY_CUSTOM_STYLE_REQUEST`
- `OUTPUT_FAILED_AUDIT`

Do not erase or replace the caller's source material in an error response.
