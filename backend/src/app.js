import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.routes.js";

const app = express();

// Needed on Render/Railway so rate limiting sees the real client IP
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: "10kb" }));
if (env.NODE_ENV !== "test") app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "VELoop Daily Streak API is running",
    serverTime: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);

// Daily streak routes will be mounted here in a later step

app.use(notFound);
app.use(errorHandler);

export default app;