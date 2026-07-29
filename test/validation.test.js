import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeInput,
  parseJsonContent,
  validatePrivateReferenceNames,
  validateVisualOutput
} from "../src/validation.js";

const limits = { maxImageBytes: 10 * 1024 * 1024 };

test("normalization rejects unsupported images", () => {
  assert.throws(
    () =>
      normalizeInput(
        {
          raw_text: "",
          image: {
            mime_type: "image/heic",
            data_base64: "YWJj"
          }
        },
        limits
      ),
    (error) => error.code === "UNSUPPORTED_IMAGE_TYPE"
  );
});

test("JSON parser accepts a fenced upstream result", () => {
  assert.deepEqual(parseJsonContent("```json\n{\"ok\":true}\n```"), {
    ok: true
  });
});

test("visual evidence rejects relationship and emotion inference", () => {
  assert.throws(
    () =>
      validateVisualOutput({
        visual_evidence: ["看起来是男朋友送的珍贵礼物"]
      }),
    (error) => error.code === "MODEL_OUTPUT_INVALID"
  );
});

test("an internal curator reference cannot appear unless the user supplied it", () => {
  assert.throws(
    () =>
      validatePrivateReferenceNames(
        { curator_note: "余华会说这是一件普通而沉重的事。" },
        {
          raw_text: "这是爸爸生前戴的手表。",
          transcript_text: "",
          follow_up_answer: "",
          rewrite_request: null,
          draft_state: {},
          existing_text: null
        }
      ),
    (error) => error.code === "MODEL_OUTPUT_INVALID"
  );
});
