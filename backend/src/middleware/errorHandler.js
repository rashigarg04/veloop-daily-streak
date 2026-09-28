import { ApiError } from "../utils/ApiError.js";

export function notFound(req, res, next) {
  next(new ApiError(404, "Route not found.", "NOT_FOUND"));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Known, safe-to-show errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // Malformed JSON body
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      code: "BAD_JSON",
      message: "The request body is not valid JSON.",
    });
  }

  // Body too large
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      code: "PAYLOAD_TOO_LARGE",
      message: "The request is too large.",
    });
  }

  // Never leak MongoServerError / CastError / stack traces to the user
  console.error("Unhandled error:", err);

  return res.status(500).json({
    success: false,
    code: "SERVER_ERROR",
    message: "Unable to process your request. Please try again.",
  });
}