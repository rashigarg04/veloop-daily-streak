import { AuditLog } from "../models/index.js";

// Audit logging must never break the main request, so errors are swallowed.
export async function logAudit(event, { req = null, userId = null, metadata = {} } = {}) {
  try {
    await AuditLog.create({
      userId,
      event,
      ip: req?.ip ?? null,
      userAgent: req?.get?.("user-agent")?.slice(0, 300) ?? null,
      metadata,
    });
  } catch (error) {
    console.error("Audit log failed:", error.message);
  }
}