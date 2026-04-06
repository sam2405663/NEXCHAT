import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";

import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { app, server } from "./lib/socket.js";

dotenv.config();

const PORT = process.env.PORT || 5000;
const __dirname = path.resolve();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:5173", // frontend dev URL
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