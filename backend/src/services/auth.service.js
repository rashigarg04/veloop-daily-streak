import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User, Wallet, WalletTransaction } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { newReferenceId } from "../utils/ids.js";
import { signToken } from "../utils/jwt.js";
import { logAudit } from "./audit.service.js";

const BCRYPT_ROUNDS = 12;
export const SIGNUP_BONUS_VES = 120;

// Used so a login for an unknown email takes the same time as a wrong password
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", BCRYPT_ROUNDS);

export function toPublicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function toPublicWallet(wallet) {
  return {
    ves: wallet?.ves ?? 0,
    giftCardInr: wallet?.giftCardInr ?? 0,
  };
}

export async function registerUser({ name, email, password }, req) {
  const existing = await User.findOne({ email }).lean();
  if (existing) {
    throw new ApiError(409, "An account with this email already exists.", "EMAIL_EXISTS");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const session = await mongoose.startSession();
  let user = null;

  try {
    await session.withTransaction(async () => {
      const [createdUser] = await User.create([{ name, email, passwordHash }], { session });

      await Wallet.create([{ userId: createdUser._id, ves: SIGNUP_BONUS_VES }], { session });

      await WalletTransaction.create(
        [
          {
            userId: createdUser._id,
            currency: "VES",
            type: "CREDIT",
            amount: SIGNUP_BONUS_VES,
            source: "SIGNUP_BONUS",
            referenceId: newReferenceId("BONUS"),
            balanceBefore: 0,
            balanceAfter: SIGNUP_BONUS_VES,
          },
        ],
        { session }
      );

      user = createdUser;
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, "An account with this email already exists.", "EMAIL_EXISTS");
    }
    throw error;
  } finally {
    await session.endSession();
  }

  await logAudit("USER_REGISTERED", { req, userId: user._id });

  return {
    token: signToken(user._id),
    user: toPublicUser(user),
    wallet: { ves: SIGNUP_BONUS_VES, giftCardInr: 0 },
  };
}

export async function loginUser({ email, password }, req) {
  const user = await User.findOne({ email }).select("+passwordHash");

  const hashToCheck = user?.passwordHash ?? DUMMY_HASH;
  const passwordOk = await bcrypt.compare(password, hashToCheck);

  if (!user || !passwordOk) {
    await logAudit("USER_LOGIN_FAILED", {
      req,
      userId: user?._id ?? null,
      metadata: { email },
    });
    throw new ApiError(401, "Invalid email or password.", "INVALID_CREDENTIALS");
  }

  if (!user.isActive) {
    throw new ApiError(403, "This account is not eligible to log in.", "ACCOUNT_DISABLED");
  }

  user.lastLoginAt = new Date();
  await user.save();

  const wallet = await Wallet.findOne({ userId: user._id }).lean();

  await logAudit("USER_LOGIN", { req, userId: user._id });

  return {
    token: signToken(user._id),
    user: toPublicUser(user),
    wallet: toPublicWallet(wallet),
  };
}

export async function getMe(user) {
  const wallet = await Wallet.findOne({ userId: user._id }).lean();
  return {
    user: toPublicUser(user),
    wallet: toPublicWallet(wallet),
  };
}