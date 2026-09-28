import { body, validationResult } from "express-validator";
import { ApiError } from "../utils/ApiError.js";

export function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
  return next(new ApiError(400, details[0].message, "VALIDATION_ERROR", details));
}

export const registerRules = [
  body("name")
    .isString().withMessage("Name is required.")
    .trim()
    .isLength({ min: 2, max: 60 }).withMessage("Name must be 2 to 60 characters."),
  body("email")
    .isString().withMessage("Email is required.")
    .trim()
    .toLowerCase()
    .isEmail().withMessage("Please enter a valid email address.")
    .isLength({ max: 120 }).withMessage("Email is too long."),
  body("password")
    .isString().withMessage("Password is required.")
    .isLength({ min: 8, max: 72 }).withMessage("Password must be 8 to 72 characters.")
    .matches(/[A-Za-z]/).withMessage("Password must contain at least one letter.")
    .matches(/\d/).withMessage("Password must contain at least one number."),
];

export const loginRules = [
  body("email")
    .isString().withMessage("Email is required.")
    .trim()
    .toLowerCase()
    .isEmail().withMessage("Please enter a valid email address."),
  body("password")
    .isString().withMessage("Password is required.")
    .notEmpty().withMessage("Password is required.")
    .isLength({ max: 72 }).withMessage("Invalid email or password."),
];