# Memento 最终馆员评语实施计划

日期：2026-07-29  
依据：`docs/superpowers/specs/2026-07-29-final-curator-note-design.md`

## 目标

把馆员评语从中间成稿移到最终收藏阶段；保留十二条内部人物路线，引入观察动作、
25 字质量闸门和动态本地降级。

## 实施顺序

### 1. 更新 Skill 与契约

涉及文件：

- `skills/memento-memory-editor/SKILL.md`
- `skills/memento-memory-editor/references/contract.md`
- `skills/memento-memory-editor/references/writing-and-editing.md`
- `skills/memento-memory-editor/references/curator-lenses.md`
- `skills/memento-memory-editor/references/test-cases.md`
- `skills/memento-memory-editor/scripts/validate_output.py`

改动：

- 增加 `finalize_memory` 模式；
- 中间成稿允许 `curator_note`、`curator_profile` 为 `null`；
- 仅最终收藏要求馆员字段；
- 把每条人物路线绑定到允许的观察动作；
- 将评语长度改为 8–25 字；
- 增加最终生成、套话、相似复述、悲伤禁用幽默等测试规则。

### 2. 扩展输入与输出校验

涉及文件：

- `src/validation.js`
- `test/validation.test.js`

改动：

- 接受 `finalize_memory`；
- 根据 `revision_state` 分别校验中间成稿与最终结果；
- 增加馆员候选结构校验；
- 增加长度、单句、证据绑定、私有人名、套话、正文相似度和路线动作兼容校验；
- 导出最终馆员及候选校验函数；
- 为所有拒绝原因增加专项单测。

### 3. 实现最终馆员服务

涉及文件：

- `src/memento-service.js`
- `src/mock-model-client.js`
- `src/prompt-loader.js`
- `test/memento-service.test.js`

改动：

- `compose_memory` 只返回正文相关字段，清空馆员字段；
- 新增 `finalize_memory` 路由；
- 最终请求读取全部 E1、E2 与 `current_draft`；
- 正常路径一次生成最多三个馆员候选；
- 选择第一条通过质量闸门的候选并合并最终成稿；
- 无有效候选时修复一次；
- 主模型与备用模型失败时进入动态本地馆员；
- 本地馆员按路线、观察动作和最终证据生成候选，不按物品返回固定句；
- Mock 模型覆盖中间成稿和最终馆员两种输出。

### 4. 调整前端最终收藏流程

涉及文件：

- `public/index.html`
- `public/app.js`
- `public/styles.css`

改动：

- 草稿页移除馆员区域；
- `renderDraft` 不读取中间馆员字段；
- “就这样收藏”改为异步调用 `finalize_memory`；
- 加载文案使用“馆员正在写下最后一句”；
- 请求失败由服务端降级处理，前端保留现有可重试错误能力；
- 最终页才展示馆员评语。

### 5. 更新说明与回归测试

涉及文件：

- `README.md`
- 相关设计文档与测试文件

验证：

1. `node --check` 检查前后端脚本；
2. `node --test` 运行全部单元与服务测试；
3. Skill Python 校验器验证中间与最终两类契约；
4. 浏览器验证首次成稿、多轮补充、风格调整均无评语；
5. 点击收藏后验证加载态和最终评语；
6. 验证最终评语不超过 25 字；
7. 验证模型失败时本地馆员仍完成收藏；
8. 检查公共响应和前端资源不包含内部人物姓名或 API Key；
9. `git diff --check` 后提交并推送 GitHub。

