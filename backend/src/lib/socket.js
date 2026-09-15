import { Server } from "socket.io";
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// Returns room name (userId) for direct message delivery
export function getReceiverSocketId(userId) {
  return userId;
}

// Stores online users and their active connection counts { userId: count }
const userSocketMap = {};

// Socket authorization middleware
io.use((socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    if (cookieHeader) {
      const jwtCookie = cookieHeader
        .split("; ")
        .find((row) => row.startsWith("jwt="));
      if (jwtCookie) {
        const token = jwtCookie.split("=")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded?.userId) {
          socket.userId = decoded.userId;
          return next();
        }
      }
    }
  } catch (error) {
    console.log("Socket auth cookie verification fallback to query param");
  }

  // Fallback to query parameter if provided
  const queryUserId = socket.handshake.query?.userId;
  if (queryUserId) {
    socket.userId = queryUserId;
    return next();
  }

  next(new Error("Authentication error"));
});

io.on("connection", (socket) => {
  const userId = socket.userId;
  console.log(`User connected: ${userId} (socket ${socket.id})`);

  if (userId) {
    socket.join(userId);
    userSocketMap[userId] = (userSocketMap[userId] || 0) + 1;
  }

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("messagesSeen", ({ senderId, receiverId }) => {
    if (senderId) {
      io.to(senderId).emit("messagesSeenByReceiver", { receiverId });
    }
  });

  socket.on("typing", ({ receiverId, senderName }) => {
    if (receiverId) {
      io.to(receiverId).emit("userTyping", { senderName });
    }
  });

  socket.on("stopTyping", ({ receiverId }) => {
    if (receiverId) {
      io.to(receiverId).emit("userStoppedTyping");
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${userId} (socket ${socket.id})`);
    if (userId && userSocketMap[userId]) {
      userSocketMap[userId] -= 1;
      if (userSocketMap[userId] <= 0) {
        delete userSocketMap[userId];
      }
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };