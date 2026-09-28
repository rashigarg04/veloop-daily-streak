import mongoose from "mongoose";

export const AUDIT_EVENTS = [
  "USER_REGISTERED",
  "USER_LOGIN",
  "USER_LOGIN_FAILED",
  "STREAK_CLAIM_REQUEST",
  "STREAK_CLAIM_SUCCESS",
  "STREAK_CLAIM_REJECTED",
  "STREAK_RESET",
  "DUPLICATE_CLAIM",
  "INVALID_CLAIM",
];

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    event: { type: String, required: true, enum: AUDIT_EVENTS, index: true },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);