import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    ves: { type: Number, default: 0, min: 0 },
    giftCardInr: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export const Wallet = mongoose.model("Wallet", walletSchema);