import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BigModelClient } from "./bigmodel-client.js";
import { loadConfig } from "./config.js";
import { AppError, toPublicError } from "./errors.js";
import { MementoService } from "./memento-service.js";
import { MockModelClient } from "./mock-model-client.js";
import { PromptLoader } from "./prompt-loader.js";

const STATIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]]
]);

function securityHeaders(contentType) {
  return {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy":
      "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'"
  };
}

function sendJson(response, status, payload) {
  response.writeHead(status, securityHeaders("application/json; charset=utf-8"));
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request, maxBytes) {
  const declared = Number.parseInt(request.headers["content-length"] ?? "0", 10);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new AppError({
      code: "IMAGE_TOO_LARGE",
      message: "这张图片太大，请选择 10 MB 以内的图片。",
      status: 413
    });
  }

  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBytes) {
      throw new AppError({
        code: "IMAGE_TOO_LARGE",
        message: "这张图片太大，请选择 10 MB 以内的图片。",
        status: 413
      });
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    throw new AppError({
      code: "INVALID_INPUT",
      message: "请求内容无法读取。",
      status: 400,
      cause: error
    });
  }
}

export function createHttpServer({ config, service, logger = console }) {
  return createServer(async (request, response) => {
    const requestId = randomUUID();
    const startedAt = Date.now();

    try {
      const url = new URL(request.url, "http://localhost");

      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, {
          ok: true,
          mode: config.mockMode ? "mock" : "live",
          text_model: config.textModel,
          vision_model: config.visionModel
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/memento") {
        const input = await readJsonBody(request, config.maxRequestBytes);
        const result = await service.process(input, requestId);
        sendJson(response, 200, {
          ...result,
          request_id: requestId
        });
        logger.info?.({
          requestId,
          route: "/api/memento",
          mode: result.mode,
          status: 200,
          durationMs: Date.now() - startedAt
        });
        return;
      }

      if (request.method === "GET" && STATIC_FILES.has(url.pathname)) {
        const [fileName, contentType] = STATIC_FILES.get(url.pathname);
        const content = await readFile(
          path.join(config.publicDirectory, fileName)
        );
        response.writeHead(200, securityHeaders(contentType));
        response.end(content);
        return;
      }

      sendJson(response, 404, {
        error: {
          code: "NOT_FOUND",
          message: "没有找到这个页面。",
          retryable: false,
          request_id: requestId
        }
      });
    } catch (error) {
      const publicError = toPublicError(error, requestId);
      sendJson(response, publicError.status, publicError.body);
      logger.error?.({
        requestId,
        route: request.url,
        code: publicError.body.error.code,
        status: publicError.status,
        durationMs: Date.now() - startedAt
      });
    }
  });
}

export async function bootstrap(env = process.env, logger = console) {
  const config = loadConfig(env);
  const promptLoader = await new PromptLoader(config.skillDirectory).initialize();
  const modelClient = config.mockMode
    ? new MockModelClient()
    : new BigModelClient({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        timeoutMs: config.requestTimeoutMs
      });
  const service = new MementoService({
    config,
    modelClient,
    promptLoader,
    logger
  });
  return {
    config,
    server: createHttpServer({ config, service, logger })
  };
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  bootstrap()
    .then(({ config, server }) => {
      server.listen(config.port, "127.0.0.1", () => {
        console.log(
          `Memento ${config.mockMode ? "mock" : "live"} server: http://127.0.0.1:${config.port}`
        );
      });
    })
    .catch((error) => {
      const publicError = toPublicError(error, "startup");
      console.error(publicError.body.error.message);
      process.exitCode = 1;
    });
}
