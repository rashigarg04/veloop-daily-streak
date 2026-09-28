import { User } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { verifyToken } from "../utils/jwt.js";

export async function protect(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new ApiError(401, "Please log in to continue.", "UNAUTHENTICATED");
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new ApiError(401, "Your session has expired. Please log in again.", "INVALID_TOKEN");
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw new ApiError(401, "Please log in to continue.", "UNAUTHENTICATED");
  }
  if (!user.isActive) {
    throw new ApiError(403, "This account is not eligible to use this feature.", "ACCOUNT_DISABLED");
  }

  // Identity comes ONLY from the verified token, never from the request body
  req.user = user;
  next();
}