# Memento HTML 验证版

这是 Memento 的可运行纵向原型。它在 iPhone 容器内验证完整的文字编辑流程：

1. 上传图片并输入文字；
2. 系统提出一个可跳过、可更换一次的问题；
3. 回答或跳过后生成默认润色正文；
4. 保留当前版本，或调整预设及自定义风格；
5. 展示短来源和一句馆员评语。

原型不进行纪念卡渲染、账号登录或云端保存。

## 模型

- `glm-4.6v-flash`：只提取图片中的可见事实；
- `glm-4.7-flash`：负责追问、正文、来源和馆员评语。
- `glm-4-flash-250414`：仅在主文字模型限流、过载或超时时临时接管文字任务。
- 如果两个模型连续生成重复或不合约的追问，服务端会返回一条本地安全追问，不把模型错误暴露给用户。

浏览器只访问本项目的 Node.js 服务。智谱 API Key 不会发送到浏览器。

## 环境要求

- Node.js 20.12 或更高版本；
- 一个智谱开放平台 API Key。

项目没有第三方运行依赖，不需要执行 `npm install`。

## 先用模拟模型体验

```bash
npm run start:mock
```

浏览器打开：

```text
http://127.0.0.1:3000
```

模拟模式不会访问智谱服务，也不会消耗额度。它用于验证界面和流程，不代表真实
模型的最终写作质量。

## 配置真实 API

复制 `.env.example` 为 `.env`，然后只在本地填写：

```dotenv
BIGMODEL_API_KEY=你的_API_Key
BIGMODEL_BASE_URL=https://open.bigmodel.cn/api/paas/v4
BIGMODEL_TEXT_MODEL=glm-4.7-flash
BIGMODEL_TEXT_FALLBACK_MODEL=glm-4-flash-250414
BIGMODEL_VISION_MODEL=glm-4.6v-flash
PORT=3000
MEMENTO_MOCK_MODE=false
```

不要把 `.env` 或 API Key 提交到 Git。仓库已经忽略 `.env`。

启动真实模型：

```bash
npm start
```

## 测试

```bash
npm test
```

测试使用模拟上游响应，覆盖模型选择、认证头、超时重试、图片证据、问题预算、
默认成稿、风格调整、Skill 契约和前端密钥隔离。

## 隐私说明

本地验证版不持久化图片和文字。真实模型模式下，当前请求中的图片和文字会发送
至智谱模型服务。公开上线前仍需补充正式的隐私政策、用户授权、内容安全、限流
和数据保留策略。
