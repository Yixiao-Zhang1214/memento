# Contract

## Contents

1. Version and modes
2. Input
3. Shared structures
4. Outputs
5. Errors

## 1. Version and modes

Use contract version `1.0`.

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
  "contract_version": "1.0",
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
  "style": "truthful",
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
- Return a structured error when the selected mode lacks required input.

## 3. Shared structures

Evidence:

```json
{
  "id": "E1-01",
  "level": "E1",
  "source": "raw_text",
  "content": "这是我第一份工作时买的杯子",
  "allowed_uses": ["title", "summary", "story_text", "curator_note"]
}
```

Tone profile:

```json
{
  "expression_mode": "terse",
  "emotional_temperature": "neutral",
  "openness": "unsure",
  "preferred_question_tone": "concrete"
}
```

Allowed tone values:

- `expression_mode`: `terse`, `fragmented`, `narrative`, `playful`, `literary`
- `emotional_temperature`: `light`, `neutral`, `tender`, `heavy`, `guarded`
- `openness`: `open`, `unsure`, `closing`
- `preferred_question_tone`: `casual`, `concrete`, `gentle`, `restrained`

## 4. Outputs

### Follow-up

```json
{
  "contract_version": "1.0",
  "status": "needs_user_input",
  "mode": "ask_followup",
  "needs_followup": true,
  "evidence": [],
  "tone_profile": {},
  "question_intent": "scene_probe",
  "question": "如果只补一个画面，你最先想到它出现在哪里？",
  "user_options": ["多留一点", "换个角度", "就这样收藏"],
  "decision_code": "ONE_HIGH_VALUE_GAP"
}
```

When no question is warranted, set `status` to `complete`,
`needs_followup` to `false`, `question` to `null`, and use one of:

- `ENOUGH_EVIDENCE`
- `USER_SKIPPED`
- `BOUNDARY_CLOSING`
- `NO_SAFE_HIGH_VALUE_QUESTION`
- `QUESTION_BUDGET_CLOSED`

### Composed memory

```json
{
  "contract_version": "1.0",
  "status": "complete",
  "mode": "compose_memory",
  "text_type": "story",
  "evidence": [],
  "tone_profile": {},
  "title": "",
  "summary": "",
  "story_text": "",
  "curator_note": "",
  "evidence_bindings": {
    "title": [],
    "summary": [],
    "story_text": [],
    "curator_note": []
  },
  "audit": {
    "passed": true,
    "unsupported_claims": [],
    "warnings": []
  }
}
```

### Polish

Require `existing_text` or source text. Return:

```json
{
  "contract_version": "1.0",
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
  "contract_version": "1.0",
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
  "contract_version": "1.0",
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
  "contract_version": "1.0",
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
- `OUTPUT_FAILED_AUDIT`

Do not erase or replace the caller's source material in an error response.
