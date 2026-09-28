import crypto from "node:crypto";

export function newId() {
  return crypto.randomUUID();
}

export function newReferenceId(prefix = "STREAK") {
  return `${prefix}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}