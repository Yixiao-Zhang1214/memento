# Test cases

Use these cases for forward testing. Judge invariants and editorial quality; do
not require exact wording.

## 1. Complete cup memory

Input:

- “这是我第一份工作时买的杯子，没什么特别，陪我熬过很多晚。我一直没丢，是想记得自己当时也撑过来了。”
- Mode: `auto`

Expect:

- Show one optional follow-up before first composition even though the facts are
  sufficient.
- Compose only after the user answers or chooses “就这样收藏”.
- Generate a `default_polish` base draft before offering style adjustment.
- Generate a short, evidence-bound `source_line`.
- Return all three post-draft actions.
- Use `story`.
- Preserve first person.
- Generate a curator note grounded in “撑过来了”.
- Route the curator note to `endurance_afterward`.
- Add no company, date, office detail, or dialogue.

## 2. Photo-only dusk

Input:

- Visual evidence: sea, orange dusk light, distant shoreline.
- No narration.
- User chooses to continue without speaking.

Expect:

- Use `quiet`.
- Describe only visible evidence and the act of keeping it.
- Generate a restrained curator note.
- Add no travel, age, freedom, transition, or mood.

## 3. Perishable flowers

Input:

- “表白时收到的一束花，早就枯了。”
- Mode: `ask_followup`

Expect:

- Never assume the flowers were physically preserved.
- Prefer `time_probe` because this is one identifiable event with no time.
- Do not ask where the flowers are now.

## 4. Closing after resignation

Input:

- “离职那天带走的工牌。先写这些吧。”
- Mode: `auto`

Expect:

- Set openness to `closing`.
- Treat “先写这些吧” as an explicit opt-out and do not ask.
- Keep tone restrained.
- Do not infer sadness, injustice, relief, or growth.

## 5. Playful ugly gift

Input:

- “朋友送的，丑得很好笑，我居然用了三年。”
- Mode: `compose_memory`

Expect:

- Keep the playful temperature.
- Generate the base draft before asking about style.
- Allow light humor in the curator note.
- Do not become sentimental about friendship.
- Do not ridicule the friend or user.

## 6. Young voice polish

Input:

- “我爷给我的笔，我平时都不用，就考试前划两下，反正就先记这些吧。”
- Mode: `polish_text`

Expect:

- Preserve “我爷”, “划两下”, and first person where natural.
- Do not write an adult memoir.
- Do not invent the grandfather's expression, desk, exam, or inheritance.

## 7. Expand without evidence

Input:

- “这是毕业时的车票。”
- Mode: `expand_text`
- Question budget: closed.

Expect:

- Produce a modest expansion or evidence-gap warning.
- Do not invent destination, companions, weather, feelings, or farewell.

## 8. Vague optimization

Input:

- Existing text with no specific request.
- User says “帮我优化得更好一点”.

Expect:

- Route to `optimization_options`.
- Return 3-5 distinct options.
- Include `light_polish`.
- Do not rewrite before the user chooses.

## 9. Named style reference

Input:

- “写得更像一位语言朴素、冷静又有一点荒诞感的作家。”
- Mode: `rewrite_text`

Expect:

- Return general `style_features`.
- Produce original wording.
- Preserve facts and person.
- Do not claim exact imitation.

## 10. Unsupported relationship audit

Input text:

- Source says “照片里有两个人”.
- Draft says “我和姐姐站在老家门口”.
- Mode: `audit_text`

Expect:

- Fail the audit.
- Identify “姐姐” and “老家” as unsupported.
- Recommend deletion or neutral visible wording.

## 11. Question replacement

Input:

- First question used `scene_probe`.
- User chooses “换一个问题”.

Expect:

- Replace with a different intent.
- Mark question state `replaced: true`.
- Do not offer another replacement after this one.
- Return only the `就这样收藏` action after replacement.

## 12. Curator-note mismatch

Input:

- User tells a light, teasing story.
- Draft curator note becomes solemn and uplifting.

Expect:

- Fail tone audit.
- Rewrite the note in a casual or lightly humorous external voice.

## 13. Complete confession still receives a question

Input:

- Image: a bouquet.
- Text: “这是男朋友告白那天送的花。他问我愿不愿意做他女朋友，我说好，我们就这么在一起了。”
- Fresh question state.

Expect:

- Ask exactly one optional question before composing.
- Use `time_probe`: “你还记得这大概是什么时候吗？”
- Accept an exact or approximate time and do not require a date.
- Offer only `换一个问题` and `就这样收藏`.
- After an answer or skip, generate a `default_polish` draft before style
  selection.
- Return `就这样收藏`, `调整风格`, and `自定义风格` after the draft.
- Keep the boyfriend in `source_line`: with time, use a form such as
  “2024年春，他的告白”; without time, use a form such as
  “他的一句‘愿不愿意’”.
- Route the eventual curator note to `first_heartbeat`.
- Do not expose the internal calibration person's name.

## 14. Grief route

Input:

- “这是爸爸生前常戴的手表。他去世以后，我把它收了起来。”

Expect:

- Route to `grief_loss`.
- Use plain facts and few adjectives in the curator note.
- Do not console, joke, diagnose, promise healing, or turn the loss into growth.
- Do not expose the internal calibration person's name.

## 15. Sparse neutral route

Input:

- Visible image: one old ticket.
- No narration.

Expect:

- Route to `neutral_sparse`.
- Ask one concrete, skippable question.
- If skipped, describe only the ticket and the act of keeping it.
- Do not infer travel, graduation, farewell, nostalgia, or companionship.

## 16. Existing time skips `time_probe`

Input:

- E3 time: “2024-05-20”.
- Text: “男朋友告白时送的花。”

Expect:

- Do not repeat the time question.
- Ask one different safe question.
- Bind the time in `source_line` to E3.

## 17. Custom style after the base draft

Input:

- A valid base draft.
- User chooses `自定义风格`.
- Request: “写成三句话，像我平时发朋友圈，别太抒情。”

Expect:

- Treat the request as E4.
- Return general `style_features` and rewrite only `story_text`.
- Preserve title, `source_line`, summary, evidence, and curator route.
- Do not ask another factual question.

## 18. Empty custom style

Input:

- A valid base draft.
- User chooses `自定义风格` but supplies no request.

Expect:

- Return recoverable `EMPTY_CUSTOM_STYLE_REQUEST`.
- Preserve the current draft.
