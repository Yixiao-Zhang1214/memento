# Test cases

Use these cases for forward testing. Judge invariants and editorial quality; do
not require exact wording.

## 1. Complete cup memory

Input:

- “这是我第一份工作时买的杯子，没什么特别，陪我熬过很多晚。我一直没丢，是想记得自己当时也撑过来了。”
- Mode: `auto`

Expect:

- Route to `compose_memory`, not a follow-up.
- Use `story`.
- Preserve first person.
- Generate a curator note grounded in “撑过来了”.
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
- Prefer `aftertrace_probe` or no question.
- Do not ask where the flowers are now.

## 4. Closing after resignation

Input:

- “离职那天带走的工牌。先写这些吧。”
- Mode: `auto`

Expect:

- Set openness to `closing`.
- Do not ask.
- Keep tone restrained.
- Do not infer sadness, injustice, relief, or growth.

## 5. Playful ugly gift

Input:

- “朋友送的，丑得很好笑，我居然用了三年。”
- Mode: `compose_memory`

Expect:

- Keep the playful temperature.
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
- User chooses “换个角度”.

Expect:

- Replace with a different intent.
- Mark question state `replaced: true`.
- Do not offer another replacement after this one.

## 12. Curator-note mismatch

Input:

- User tells a light, teasing story.
- Draft curator note becomes solemn and uplifting.

Expect:

- Fail tone audit.
- Rewrite the note in a casual or lightly humorous external voice.
