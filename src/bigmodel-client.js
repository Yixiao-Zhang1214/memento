import { AppError } from "./errors.js";

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelayMs(response) {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) {
      return Math.min(5_000, Math.max(250, seconds * 1_000));
    }
    const date = Date.parse(header);
    if (Number.isFinite(date)) {
      return Math.min(5_000, Math.max(250, date - Date.now()));
    }
  }
  return response.status === 429
    ? 3_000 + Math.floor(Math.random() * 2_000)
    : 500;
}

function mapUpstreamError(status) {
  if (status === 401 || status === 403) {
    return new AppError({
      code: "UPSTREAM_AUTH_FAILED",
      message: "模型服务鉴权失败，请检查本地 API Key。",
      status: 502,
      retryable: false
    });
  }
  if (status === 429) {
    return new AppError({
      code: "UPSTREAM_RATE_LIMITED",
      message: "现在整理的人有点多，请稍后再试。",
      status: 503,
      retryable: true
    });
  }
  if (status >= 500) {
    return new AppError({
      code: "UPSTREAM_UNAVAILABLE",
      message: "模型服务暂时不可用，请稍后再试。",
      status: 503,
      retryable: true
    });
  }
  return new AppError({
    code: "UPSTREAM_REJECTED",
    message: "模型服务没有接受这次请求，请检查输入后重试。",
    status: 502,
    retryable: false
  });
}

export class BigModelClient {
  constructor({ apiKey, baseUrl, timeoutMs = 60_000, fetchImpl = fetch }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  async complete({
    model,
    messages,
    thinking,
    temperature,
    maxTokens,
    responseFormat
  }) {
    const body = {
      model,
      messages,
      stream: false,
      thinking,
      temperature,
      max_tokens: maxTokens
    };

    if (responseFormat) {
      body.response_format = responseFormat;
    }

    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(
          `${this.baseUrl}/chat/completions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(body),
            signal: controller.signal
          }
        );

        if (!response.ok) {
          lastError = mapUpstreamError(response.status);
          if (attempt === 0 && RETRYABLE_STATUS.has(response.status)) {
            await wait(retryDelayMs(response));
            continue;
          }
          throw lastError;
        }

        let payload;
        try {
          payload = await response.json();
        } catch (error) {
          throw new AppError({
            code: "MODEL_OUTPUT_INVALID",
            message: "模型返回了无法读取的结果，请重试。",
            status: 502,
            retryable: true,
            cause: error
          });
        }

        const content = payload?.choices?.[0]?.message?.content;
        if (typeof content !== "string" || content.trim() === "") {
          throw new AppError({
            code: "MODEL_OUTPUT_INVALID",
            message: "模型没有返回可用文字，请重试。",
            status: 502,
            retryable: true
          });
        }

        return {
          content,
          upstreamRequestId: payload.request_id ?? payload.id ?? null,
          usage: payload.usage ?? null
        };
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }

        const timedOut = error?.name === "AbortError";
        lastError = new AppError({
          code: timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE",
          message: timedOut
            ? "这次整理等得有点久，请再试一次。"
            : "暂时无法连接模型服务，请稍后再试。",
          status: 503,
          retryable: true,
          cause: error
        });

        if (attempt === 0) {
          await wait(250);
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError;
  }
}
