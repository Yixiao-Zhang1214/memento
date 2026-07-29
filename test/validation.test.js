import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeInput,
  parseJsonContent,
  validateComposeEvidence,
  validateFollowupRelevance,
  validatePrivateReferenceNames,
  validateRewriteEvidence,
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

test("normalization accepts history-only input and removes duplicate entry ids", () => {
  const normalized = normalizeInput(
    {
      contract_version: "1.1",
      mode: "compose_memory",
      conversation_history: [
        {
          id: "entry-1",
          round: 0,
          role: "user",
          kind: "initial",
          content: "这是第一段内容。"
        },
        {
          id: "entry-1",
          round: 1,
          role: "user",
          kind: "supplement",
          content: "这条重复 ID 不应再次进入历史。"
        },
        {
          id: "entry-2",
          round: 1,
          role: "assistant",
          kind: "question",
          content: "后来又发生了什么？"
        }
      ],
      conversation_round: {
        index: 1,
        trigger: "supplement"
      }
    },
    limits
  );

  assert.equal(normalized.conversation_history.length, 2);
  assert.equal(normalized.conversation_round.index, 1);
  assert.equal(normalized.conversation_round.trigger, "supplement");
});

test("normalization rejects a question disguised as user history", () => {
  assert.throws(
    () =>
      normalizeInput(
        {
          conversation_history: [
            {
              id: "entry-1",
              round: 0,
              role: "user",
              kind: "question",
              content: "这是一个错误角色的问题。"
            }
          ]
        },
        limits
      ),
    (error) => error.code === "INVALID_INPUT"
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

test("a follow-up cannot ask for a replacement reason already supplied", () => {
  assert.throws(
    () =>
      validateFollowupRelevance(
        {
          question: "你还记得是什么让你决定换掉这部手机的吗？"
        },
        {
          raw_text:
            "这是我用了6年的手机，我没办法继续使用了，因为内存不够。",
          transcript_text: "",
          visual_evidence: []
        }
      ),
    (error) =>
      error.code === "MODEL_OUTPUT_INVALID" &&
      error.details?.reason === "QUESTION_REPEATS_KNOWN_INFORMATION"
  );
});

test("a follow-up cannot ask a duration already supplied", () => {
  assert.throws(
    () =>
      validateFollowupRelevance(
        { question: "这部手机你用了多久？" },
        {
          raw_text: "这是我用了6年的手机。",
          transcript_text: "",
          visual_evidence: []
        }
      ),
    (error) => error.code === "MODEL_OUTPUT_INVALID"
  );
});

test("a follow-up cannot repeat an earlier assistant question", () => {
  assert.throws(
    () =>
      validateFollowupRelevance(
        { question: "用了这么久，你最舍不得它的是什么？" },
        {
          raw_text: "这是我用了六年的手机。",
          transcript_text: "",
          visual_evidence: [],
          conversation_history: [
            {
              id: "entry-1",
              round: 0,
              role: "assistant",
              kind: "question",
              content: "用了这么久，你最舍不得它的是什么？"
            }
          ]
        }
      ),
    (error) =>
      error.code === "MODEL_OUTPUT_INVALID" &&
      error.details?.reason === "QUESTION_REPEATS_HISTORY"
  );
});

test("a follow-up cannot ask what was most missed after the user already said it", () => {
  assert.throws(
    () =>
      validateFollowupRelevance(
        { question: "用了这么久，你最舍不得它的是什么？" },
        {
          raw_text: "这是我用了六年的手机。",
          transcript_text: "",
          visual_evidence: [],
          conversation_history: [
            {
              id: "entry-1",
              round: 0,
              role: "user",
              kind: "initial",
              content: "这是我用了六年的手机。"
            },
            {
              id: "entry-2",
              round: 1,
              role: "user",
              kind: "supplement",
              content: "我其实最舍不得的是它的直面屏。"
            }
          ]
        }
      ),
    (error) =>
      error.code === "MODEL_OUTPUT_INVALID" &&
      error.details?.reason === "QUESTION_REPEATS_KNOWN_INFORMATION"
  );
});

test("a supplement round must follow the newly added detail", () => {
  assert.throws(
    () =>
      validateFollowupRelevance(
        { question: "除了内存，它最好用的地方是什么？" },
        {
          raw_text: "这是我用了六年的手机，只有64G。",
          transcript_text: "",
          visual_evidence: [],
          conversation_history: [
            {
              id: "entry-1",
              round: 0,
              role: "user",
              kind: "initial",
              content: "这是我用了六年的手机，只有64G。"
            },
            {
              id: "entry-2",
              round: 1,
              role: "user",
              kind: "supplement",
              content: "大学毕业时，我用它拍了最后一张宿舍合照。"
            }
          ],
          conversation_round: {
            index: 1,
            trigger: "supplement"
          }
        }
      ),
    (error) =>
      error.code === "MODEL_OUTPUT_INVALID" &&
      error.details?.reason === "QUESTION_MISSES_CURRENT_SUPPLEMENT"
  );

  assert.doesNotThrow(() =>
    validateFollowupRelevance(
      { question: "拍下那张照片时，有没有一句话或一个动作你还记得？" },
      {
        raw_text: "这是我用了六年的手机，只有64G。",
        transcript_text: "",
        visual_evidence: [],
        conversation_history: [
          {
            id: "entry-1",
            round: 1,
            role: "user",
            kind: "supplement",
            content: "大学毕业时，我用它拍了最后一张宿舍合照。"
          }
        ],
        conversation_round: {
          index: 1,
          trigger: "supplement"
        }
      }
    )
  );
});

test("a follow-up follows a written keyword instead of image atmosphere", () => {
  assert.throws(
    () =>
      validateFollowupRelevance(
        { question: "你在这幅画中感受到了怎样的氛围？" },
        {
          raw_text: "这是字节跳动今年的关键词，勇攀高峰。",
          transcript_text: "",
          visual_evidence: ["画面中有一座山"]
        }
      ),
    (error) =>
      error.code === "MODEL_OUTPUT_INVALID" &&
      error.details?.reason === "QUESTION_MISSES_TEXT_TARGET"
  );
});

test("a composed memory cannot invent a calendar year", () => {
  assert.throws(
    () =>
      validateComposeEvidence(
        {
          title: "一部老手机",
          source_line: "2023年，一部64G手机",
          summary: "一部手机。",
          story_text: "这是一部用了6年的手机。",
          curator_note: "它被留了下来。"
        },
        {
          raw_text: "这是我用了6年的手机。",
          transcript_text: "",
          follow_up_answer: "",
          visual_evidence: []
        }
      ),
    (error) =>
      error.code === "MODEL_OUTPUT_INVALID" &&
      error.details?.reason === "UNSUPPORTED_TIME_CLAIM"
  );
});

test("default polish cannot turn a short input into invented memoir", () => {
  assert.throws(
    () =>
      validateComposeEvidence(
        {
          title: "一部旧手机",
          source_line: "我和它的六年",
          summary: "一部手机。",
          story_text:
            "这是我用了6年的手机。它陪我度过了许多难忘的时刻，我怀念它，也明白是时候向前看了。它不仅仅是通讯工具，更是我生活的一部分。",
          curator_note: "它被留了下来。"
        },
        {
          raw_text: "这是我用了6年的手机，因为内存不够不能再用了。",
          transcript_text: "",
          follow_up_answer: "",
          visual_evidence: []
        }
      ),
    (error) =>
      error.code === "MODEL_OUTPUT_INVALID" &&
      [
        "UNSUPPORTED_NARRATIVE_EXPANSION",
        "UNSUPPORTED_NARRATIVE_CLAIM"
      ].includes(error.details?.reason)
  );
});

test("style rewrite cannot change the narrator or add unsupported meaning", () => {
  assert.throws(
    () =>
      validateRewriteEvidence(
        {
          rewritten_text:
            "六年的陪伴，它见证了你的清内存，也承载了你的生活。"
        },
        {
          current_draft: {
            title: "64G的六年",
            source_line: "我和它的六年",
            summary: "一部依然好用的手机。",
            story_text: "这是我用了6年的手机。它很好用，但内存不够。",
            curator_note: "它被留了下来。"
          },
          rewrite_request: null,
          draft_state: {}
        }
      ),
    (error) =>
      error.code === "MODEL_OUTPUT_INVALID" &&
      [
        "UNSUPPORTED_NARRATIVE_CLAIM",
        "UNSUPPORTED_VOICE_SHIFT"
      ].includes(error.details?.reason)
  );
});

test("a composed memory cannot drop the user's organization and keyword", () => {
  assert.throws(
    () =>
      validateComposeEvidence(
        {
          title: "勇攀高峰",
          source_line: "山顶的剪影",
          summary: "星空下的攀登。",
          story_text: "山顶上有三道剪影高举双手。",
          curator_note: "星光把欢呼留在高处。"
        },
        {
          raw_text: "这是字节跳动今年的关键词，勇攀高峰。",
          transcript_text: "",
          follow_up_answer: "",
          visual_evidence: ["画面中有一座山"]
        }
      ),
    (error) =>
      error.code === "MODEL_OUTPUT_INVALID" &&
      error.details?.reason === "INSUFFICIENT_EVIDENCE_COVERAGE"
  );
});
