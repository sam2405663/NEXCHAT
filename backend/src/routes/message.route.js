import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getUsersForSidebar,
  getMessages,
  sendMessage,
  markMessagesAsSeen,
  getChatUsers,
} from "../controllers/message.controller.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/chats", protectRoute, getChatUsers);
router.get("/:id", protectRoute, getMessages);
router.put("/seen/:id", protectRoute, markMessagesAsSeen);

router.post("/send/:id", protectRoute, sendMessage);

export default router;