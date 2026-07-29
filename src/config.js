import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "./errors.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDirectory, "..");

function parseBoolean(value) {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "").trim().toLowerCase()
  );
}

function parsePort(value) {
  const port = Number.parseInt(value ?? "3000", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new AppError({
      code: "CONFIG_INVALID",
      message: "PORT 必须是 1 到 65535 之间的整数。",
      status: 500
    });
  }
  return port;
}

export function loadConfig(env = process.env) {
  const mockMode = parseBoolean(env.MEMENTO_MOCK_MODE);
  const apiKey = String(env.BIGMODEL_API_KEY ?? "").trim();

  if (!mockMode && !apiKey) {
    throw new AppError({
      code: "CONFIG_MISSING",
      message: "缺少 BIGMODEL_API_KEY，请先在本地 .env 中配置。",
      status: 500
    });
  }

  return Object.freeze({
    apiKey,
    baseUrl: String(
      env.BIGMODEL_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4"
    ).replace(/\/+$/, ""),
    textModel: String(env.BIGMODEL_TEXT_MODEL ?? "glm-4.7-flash"),
    visionModel: String(env.BIGMODEL_VISION_MODEL ?? "glm-4.6v-flash"),
    port: parsePort(env.PORT),
    mockMode,
    requestTimeoutMs: 60_000,
    maxImageBytes: 10 * 1024 * 1024,
    maxRequestBytes: 15 * 1024 * 1024,
    projectRoot,
    publicDirectory: path.join(projectRoot, "public"),
    skillDirectory:
      env.MEMENTO_SKILL_DIR ??
      path.join(projectRoot, "skills", "memento-memory-editor")
  });
}
