import { body, query, validationResult } from "express-validator";
import { ApiError } from "../utils/ApiError.js";

export function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
  return next(new ApiError(400, details[0].message, "VALIDATION_ERROR", details));
}

// "day" is only a hint the service double-checks against the database.
// Any other field the client sends (reward, amount, currency, userId, streak...)
// is simply never read anywhere in the controller or service.
export const claimRules = [
  body("day")
    .optional({ nullable: true })
    .isInt({ min: 1, max: 60 }).withMessage("Invalid day value.")
    .toInt(),
  body("idempotencyKey")
    .optional({ nullable: true })
    .isString().withMessage("Invalid idempotency key.")
    .isLength({ min: 8, max: 100 }).withMessage("Invalid idempotency key.")
    .matches(/^[A-Za-z0-9_-]+$/).withMessage("Invalid idempotency key."),
];

export const historyRules = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 50 }).toInt(),
];