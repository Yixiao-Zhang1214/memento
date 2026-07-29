export class AppError extends Error {
  constructor({
    code,
    message,
    status = 500,
    retryable = false,
    cause,
    details
  }) {
    super(message, { cause });
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.details = details;
  }
}

export function toPublicError(error, requestId) {
  const normalized =
    error instanceof AppError
      ? error
      : new AppError({
          code: "INTERNAL_ERROR",
          message: "这次整理没有完成，请稍后再试。",
          status: 500,
          retryable: true,
          cause: error
        });

  return {
    status: normalized.status,
    body: {
      error: {
        code: normalized.code,
        message: normalized.message,
        retryable: normalized.retryable,
        request_id: requestId
      }
    }
  };
}
