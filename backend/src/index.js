import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { app, server } from "./lib/socket.js";

const PORT = process.env.PORT || 5001;
const __dirname = path.resolve();

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
].filter(Boolean);

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
  // Adjusted path: assuming 'frontend' and 'backend' are siblings in your root
  const frontendDistPath = path.join(__dirname, "../frontend/dist");

  // Serve static files
  app.use(express.static(frontendDistPath));

  /**
   * MODERN WILDCARD SYNTAX (v8+)
   * The { } syntax defines a group, and /*any tells it to capture 
   * everything including slashes into a parameter named 'any'.
   */
  app.get("{/*any}", (req, res) => {
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

// Start server
server.listen(PORT, async () => {
  console.log(`Server is running on PORT: ${PORT}`);
  await connectDB();
});