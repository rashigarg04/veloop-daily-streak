import mongoose from "mongoose";
import { newId } from "../utils/ids.js";

const walletTransactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true, default: newId },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    currency: { type: String, required: true, enum: ["VES", "INR"] },
    type: { type: String, required: true, enum: ["CREDIT", "DEBIT"] },
    amount: { type: Number, required: true, min: 0 },
    source: { type: String, required: true, enum: ["DAILY_STREAK", "SIGNUP_BONUS"] },
    streakDay: { type: Number, default: null },
    referenceId: { type: String, required: true, unique: true },
    claimId: { type: String, default: null },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    status: { type: String, enum: ["SUCCESS", "FAILED"], default: "SUCCESS" },
  },
  { timestamps: true }
);

walletTransactionSchema.index({ userId: 1, createdAt: -1 });

export const WalletTransaction = mongoose.model("WalletTransaction", walletTransactionSchema);