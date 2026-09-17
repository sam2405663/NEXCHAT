import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { app, server } from "./lib/socket.js";

const PORT = process.env.PORT || 5001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    origin: process.env.NODE_ENV === "production" ? (process.env.CLIENT_URL || true) : allowedOrigins,
    credentials: true,
  })
);

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
  const rootDistPath = path.resolve(process.cwd(), "frontend/dist");
  const relativeDistPath = path.join(__dirname, "../../frontend/dist");
  const frontendDistPath = fs.existsSync(rootDistPath) ? rootDistPath : relativeDistPath;

  console.log(`Serving frontend static files from: ${frontendDistPath}`);

  // Serve static files
  app.use(express.static(frontendDistPath));

  app.use((req, res) => {
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

// Start server
server.listen(PORT, async () => {
  console.log(`Server is running on PORT: ${PORT}`);
  await connectDB();
});