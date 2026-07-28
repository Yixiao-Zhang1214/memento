#!/usr/bin/env python3
"""Validate deterministic parts of the Memento Memory Editor JSON contract."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


CONTRACT_VERSION = "1.0"
MODES = {
    "ask_followup",
    "compose_memory",
    "polish_text",
    "expand_text",
    "optimization_options",
    "rewrite_text",
    "audit_text",
}
STATUSES = {"needs_user_input", "complete", "blocked"}
TEXT_TYPES = {"story", "quiet"}
QUESTION_INTENTS = {
    "scene_probe",
    "sensory_probe",
    "moment_probe",
    "contrast_probe",
    "aftertrace_probe",
    "significance_probe",
    "future_probe",
    "choice_probe",
}
TONE_ENUMS = {
    "expression_mode": {"terse", "fragmented", "narrative", "playful", "literary"},
    "emotional_temperature": {"light", "neutral", "tender", "heavy", "guarded"},
    "openness": {"open", "unsure", "closing"},
    "preferred_question_tone": {"casual", "concrete", "gentle", "restrained"},
}
SENTENCE_END_RE = re.compile(r"[。！？!?]+")


def chinese_length(value: str) -> int:
    """Count Unicode code points after trimming surrounding whitespace."""
    return len(value.strip())


def require_string(
    data: dict[str, Any], field: str, errors: list[str], allow_empty: bool = False
) -> str:
    value = data.get(field)
    if not isinstance(value, str):
        errors.append(f"{field}: expected string")
        return ""
    if not allow_empty and not value.strip():
        errors.append(f"{field}: must not be empty")
    return value


def validate_tone_profile(data: dict[str, Any], errors: list[str]) -> None:
    tone = data.get("tone_profile")
    if not isinstance(tone, dict):
        errors.append("tone_profile: expected object")
        return
    for field, allowed in TONE_ENUMS.items():
        value = tone.get(field)
        if value not in allowed:
            errors.append(f"tone_profile.{field}: invalid value {value!r}")


def validate_audit(data: dict[str, Any], errors: list[str]) -> None:
    audit = data.get("audit")
    if not isinstance(audit, dict):
        errors.append("audit: expected object")
        return
    if not isinstance(audit.get("passed"), bool):
        errors.append("audit.passed: expected boolean")
    for field in ("unsupported_claims", "warnings"):
        if not isinstance(audit.get(field), list):
            errors.append(f"audit.{field}: expected array")


def evidence_ids(data: dict[str, Any], errors: list[str]) -> set[str]:
    evidence = data.get("evidence")
    if not isinstance(evidence, list):
        errors.append("evidence: expected array")
        return set()
    ids: set[str] = set()
    for index, item in enumerate(evidence):
        if not isinstance(item, dict):
            errors.append(f"evidence[{index}]: expected object")
            continue
        item_id = item.get("id")
        if not isinstance(item_id, str) or not item_id:
            errors.append(f"evidence[{index}].id: expected non-empty string")
        elif item_id in ids:
            errors.append(f"evidence[{index}].id: duplicate {item_id!r}")
        else:
            ids.add(item_id)
    return ids


def validate_bindings(
    data: dict[str, Any], ids: set[str], errors: list[str]
) -> None:
    bindings = data.get("evidence_bindings")
    if not isinstance(bindings, dict):
        errors.append("evidence_bindings: expected object")
        return
    for field in ("title", "summary", "story_text", "curator_note"):
        values = bindings.get(field)
        if not isinstance(values, list):
            errors.append(f"evidence_bindings.{field}: expected array")
            continue
        for value in values:
            if value not in ids:
                errors.append(
                    f"evidence_bindings.{field}: unknown evidence id {value!r}"
                )


def validate_question(data: dict[str, Any], errors: list[str]) -> None:
    needs = data.get("needs_followup")
    if not isinstance(needs, bool):
        errors.append("needs_followup: expected boolean")
        return
    if not needs:
        if data.get("question") not in (None, ""):
            errors.append("question: must be null when needs_followup is false")
        return

    question = require_string(data, "question", errors)
    if question:
        marks = question.count("?") + question.count("？")
        if marks > 1:
            errors.append("question: must contain at most one question mark")
        if chinese_length(question) > 80:
            errors.append("question: exceeds 80 characters")
    if data.get("question_intent") not in QUESTION_INTENTS:
        errors.append(f"question_intent: invalid value {data.get('question_intent')!r}")
    options = data.get("user_options")
    if not isinstance(options, list) or len(options) != 3:
        errors.append("user_options: expected exactly three options")


def validate_compose(
    data: dict[str, Any], errors: list[str], warnings: list[str]
) -> None:
    if data.get("text_type") not in TEXT_TYPES:
        errors.append(f"text_type: invalid value {data.get('text_type')!r}")
    ids = evidence_ids(data, errors)
    validate_tone_profile(data, errors)
    validate_audit(data, errors)
    fields = {
        "title": (4, 18),
        "summary": (12, 36),
        "story_text": (30, 260),
        "curator_note": (8, 80),
    }
    values: dict[str, str] = {}
    for field, (soft_min, soft_max) in fields.items():
        value = require_string(data, field, errors)
        values[field] = value
        length = chinese_length(value)
        if value and not (soft_min <= length <= soft_max):
            warnings.append(
                f"{field}: length {length} outside recommended {soft_min}-{soft_max}"
            )
    note = values.get("curator_note", "")
    if note:
        segments = [part for part in SENTENCE_END_RE.split(note) if part.strip()]
        if len(segments) > 1:
            errors.append("curator_note: must be one sentence")
    validate_bindings(data, ids, errors)


def validate_edit_mode(data: dict[str, Any], mode: str, errors: list[str]) -> None:
    fields = {
        "polish_text": ("polished_text", "edit_note"),
        "expand_text": ("expanded_text", "edit_note"),
        "rewrite_text": ("rewritten_text", "edit_note"),
    }
    for field in fields[mode]:
        require_string(data, field, errors)
    if mode == "rewrite_text":
        if not isinstance(data.get("style_features"), list):
            errors.append("style_features: expected array")
        require_string(data, "rewrite_request", errors)
    validate_audit(data, errors)


def validate_options(data: dict[str, Any], errors: list[str]) -> None:
    require_string(data, "question", errors)
    options = data.get("options")
    if not isinstance(options, list) or not 3 <= len(options) <= 5:
        errors.append("options: expected 3-5 items")
        return
    ids: list[str] = []
    for index, item in enumerate(options):
        if not isinstance(item, dict):
            errors.append(f"options[{index}]: expected object")
            continue
        for field in ("id", "label", "description"):
            value = item.get(field)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"options[{index}].{field}: expected non-empty string")
        if isinstance(item.get("id"), str):
            ids.append(item["id"])
    if "light_polish" not in ids:
        errors.append("options: must include light_polish")


def validate_error(data: dict[str, Any], errors: list[str]) -> None:
    require_string(data, "error_code", errors)
    require_string(data, "message", errors)
    if not isinstance(data.get("recoverable"), bool):
        errors.append("recoverable: expected boolean")
    if not isinstance(data.get("required_fields"), list):
        errors.append("required_fields: expected array")


def validate(data: Any) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    if not isinstance(data, dict):
        return {"valid": False, "errors": ["root: expected object"], "warnings": []}

    if data.get("contract_version") != CONTRACT_VERSION:
        errors.append(
            f"contract_version: expected {CONTRACT_VERSION!r}, "
            f"got {data.get('contract_version')!r}"
        )
    status = data.get("status")
    if status not in STATUSES:
        errors.append(f"status: invalid value {status!r}")
    mode = data.get("mode")
    if mode not in MODES:
        errors.append(f"mode: invalid value {mode!r}")
    if errors and mode not in MODES:
        return {"valid": False, "errors": errors, "warnings": warnings}

    if status == "blocked":
        validate_error(data, errors)
    elif mode == "ask_followup":
        validate_tone_profile(data, errors)
        evidence_ids(data, errors)
        validate_question(data, errors)
    elif mode == "compose_memory":
        validate_compose(data, errors, warnings)
    elif mode in {"polish_text", "expand_text", "rewrite_text"}:
        validate_edit_mode(data, mode, errors)
    elif mode == "optimization_options":
        validate_options(data, errors)
    elif mode == "audit_text":
        validate_audit(data, errors)

    return {"valid": not errors, "errors": errors, "warnings": warnings}


def load_json(path: str) -> Any:
    if path == "-":
        return json.load(sys.stdin)
    with Path(path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate Memento Memory Editor output JSON."
    )
    parser.add_argument("path", help="JSON file path, or - for stdin")
    args = parser.parse_args()
    try:
        data = load_json(args.path)
    except (OSError, json.JSONDecodeError) as exc:
        report = {"valid": False, "errors": [f"input: {exc}"], "warnings": []}
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1

    report = validate(data)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
