function evidenceBindings(evidence) {
  return evidence.map((item) => item.id);
}

function toneProfile(rawText) {
  const heavy = /(去世|生前|送走|分手|离开了)/.test(rawText);
  const playful = /(好笑|居然|丑|吐槽|哈哈)/.test(rawText);
  const tender = /(告白|男朋友|女朋友|喜欢|抱了抱)/.test(rawText);
  const changedObject = /(手机|64G|内存|用了六年)/i.test(rawText);
  return {
    expression_mode: playful ? "playful" : "narrative",
    emotional_temperature: heavy
      ? "heavy"
      : tender
        ? "tender"
        : playful
          ? "light"
          : "neutral",
    openness: "open",
    preferred_question_tone: heavy
      ? "restrained"
      : tender
        ? "gentle"
        : playful
          ? "casual"
          : "concrete",
    curator_emotion_route: heavy
      ? "regret_parting"
      : tender
        ? "first_heartbeat"
        : changedObject
          ? "nostalgia_change"
        : playful
          ? "absurd_self_mockery"
          : "neutral_sparse"
  };
}

function chooseFollowup(rawText, replaced) {
  if (replaced) {
    return {
      intent: "scene_probe",
      question: "当时有没有一句话或一个动作，你还记得？"
    };
  }
  if (/(告白|表白|愿不愿意)/.test(rawText)) {
    return {
      intent: "aftertrace_probe",
      question: "他说完那句话以后，你们做了什么？"
    };
  }
  if (/(小狗|比熊|送走)/.test(rawText)) {
    return {
      intent: "moment_probe",
      question: "她在家的时候，有没有一件事是你到现在还记得的？"
    };
  }
  if (/(出差|又是)/.test(rawText)) {
    return {
      intent: "significance_probe",
      question: "你写“又是出差的一天”时，是什么心情？"
    };
  }
  if (/(手机|64G|内存)/i.test(rawText)) {
    return {
      intent: "contrast_probe",
      question: "用了这么久，你最舍不得它的是什么？"
    };
  }
  return {
    intent: "moment_probe",
    question: "看到它时，你会先想起哪件事？"
  };
}

function selectCopy(rawText, followUpAnswer) {
  const joined = [rawText, followUpAnswer].filter(Boolean).join("。");
  if (/(告白|表白|愿不愿意)/.test(rawText)) {
    return {
      title: "告白那天的花",
      source: "他的一句“愿不愿意”",
      summary: "一束花和一句话，留下了两个人关系开始的那天。",
      story: joined,
      note: "这束花替一个冒险的问题壮了胆，又被一个“好”留到了现在。",
      route: "first_heartbeat",
      lens: "clean_first_moment"
    };
  }
  if (/(小狗|比熊|送走)/.test(rawText)) {
    return {
      title: "她在家的日子",
      source: "她住在家里的时候",
      summary: "关于一只曾经住进家里，后来又离开的小狗。",
      story: joined,
      note: "记不清时间并没有让她消失，能被说出的那件小事才是她留下的地方。",
      route: "regret_parting",
      lens: "residual_everyday_image"
    };
  }
  if (/(手机|64G|内存)/i.test(rawText)) {
    return {
      title: "64G的六年",
      source: "我和它的六年",
      summary: "一部依然好用，却装不下后来生活的旧手机。",
      story: joined,
      note: "它用了六年都没有变得难用，只是你的生活比64G长得更快。",
      route: "nostalgia_change",
      lens: "change_through_use"
    };
  }
  if (/(出差|馄饨|早餐)/.test(rawText)) {
    return {
      title: "又是出差的一天",
      source: "出差日的早餐",
      summary: "一顿还不错的早餐，夹在又一次出差的开头。",
      story: joined,
      note: "早餐只负责好吃，那个“又”字才替这一天留下了重量。",
      route: "neutral_sparse",
      lens: "small_word_observation"
    };
  }
  return {
    title: "被留下的这一刻",
    source: "镜头里的这一天",
    summary: "从一件眼前的东西，留下一段愿意记住的话。",
    story: joined || "这张图片被留在了这里。",
    note: "它没有替你解释什么，只把你愿意留下的部分放在了这里。",
    route: "neutral_sparse",
    lens: "object_first_observation"
  };
}

function styleFeatures(input) {
  if (input.draft_state?.custom_style_request) {
    return input.draft_state.custom_style_request
      .split(/[，,、]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 4);
  }
  const map = {
    truthful: ["自然用词", "具体叙述"],
    private_label: ["私人藏品说明", "简洁来源"],
    light_poetic: ["轻微诗意", "单一意象"],
    dry_humor: ["克制幽默", "事实反差"],
    fantasy_archive: ["档案语气", "低幻想强度"]
  };
  return map[input.style] ?? ["默认润色"];
}

export class MockModelClient {
  async complete({ purpose, input = {}, evidence = [] }) {
    if (purpose.startsWith("vision")) {
      return {
        content: JSON.stringify({
          visual_evidence: ["画面中有一个被清楚拍下的主要物品"]
        }),
        upstreamRequestId: "mock-vision",
        usage: null
      };
    }

    const conversationText = Array.isArray(input.conversation_history)
      ? input.conversation_history
          .filter((item) => item?.role === "user")
          .map((item) => item.content)
          .filter(Boolean)
      : [];
    const rawText =
      conversationText.length > 0
        ? conversationText.join("。")
        : input.raw_text ?? "";
    if (purpose.startsWith("follow_up")) {
      const selected = chooseFollowup(
        rawText,
        Boolean(input.question_state?.replaced)
      );
      const replaced = Boolean(input.question_state?.replaced);
      return {
        content: JSON.stringify({
          contract_version: "1.1",
          status: "needs_user_input",
          mode: "ask_followup",
          needs_followup: true,
          evidence,
          tone_profile: toneProfile(rawText),
          question_intent: selected.intent,
          question: selected.question,
          user_actions: replaced
            ? [{ id: "compose_now", label: "就这样收藏" }]
            : [
                { id: "replace_question", label: "换一个问题" },
                { id: "compose_now", label: "就这样收藏" }
              ],
          decision_code: "MANDATORY_OPTIONAL_QUESTION"
        }),
        upstreamRequestId: "mock-follow-up",
        usage: null
      };
    }

    if (purpose.startsWith("rewrite")) {
      const story = input.current_draft?.story_text ?? "";
      const prefix =
        input.style === "private_label"
          ? "藏品记录："
          : input.style === "fantasy_archive"
            ? "档案记录："
            : "";
      return {
        content: JSON.stringify({
          contract_version: "1.1",
          status: "complete",
          mode: "rewrite_text",
          rewrite_request:
            input.draft_state?.custom_style_request ?? input.style,
          style_features: styleFeatures(input),
          rewritten_text: `${prefix}${story}`,
          edit_note: "只调整正文表达，事实保持不变。",
          audit: {
            passed: true,
            unsupported_claims: [],
            warnings: []
          }
        }),
        upstreamRequestId: "mock-rewrite",
        usage: null
      };
    }

    const copy = selectCopy(
      rawText,
      conversationText.length > 0 ? "" : input.follow_up_answer ?? ""
    );
    const ids = evidenceBindings(evidence);
    return {
      content: JSON.stringify({
        contract_version: "1.1",
        status: "needs_user_input",
        mode: "compose_memory",
        draft_stage: "base_polished",
        revision_state: "awaiting_direction",
        text_type: rawText ? "story" : "quiet",
        evidence,
        tone_profile: toneProfile(rawText),
        title: copy.title,
        source_line: copy.source,
        summary: copy.summary,
        story_text: copy.story,
        curator_note: copy.note,
        curator_profile: {
          emotion_route: copy.route,
          lens_id: copy.lens
        },
        evidence_bindings: {
          title: ids,
          source_line: ids,
          summary: ids,
          story_text: ids,
          curator_note: ids
        },
        post_draft_actions: [
          { id: "continue_supplement", label: "继续补充" },
          { id: "ask_more", label: "再问我一个问题" },
          { id: "keep_draft", label: "就这样收藏" },
          { id: "adjust_style", label: "调整风格" },
          { id: "custom_style", label: "自定义风格" }
        ],
        audit: {
          passed: true,
          unsupported_claims: [],
          warnings: []
        }
      }),
      upstreamRequestId: "mock-compose",
      usage: null
    };
  }
}
