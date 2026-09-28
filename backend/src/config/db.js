import dns from "node:dns";
import mongoose from "mongoose";
import { env } from "./env.js";

// Some networks block SRV lookups; use public DNS resolvers instead
dns.setServers(["8.8.8.8", "1.1.1.1"]);

export async function connectDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGO_URI);
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
}