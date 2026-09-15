import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

// GET SAVED CONTACTS (Only users added via User ID search)
export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const currentUser = await User.findById(loggedInUserId).populate("contacts", "-password");

    res.status(200).json(currentUser?.contacts || []);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// SEARCH USER BY USER ID / TAG & ADD TO CONTACTS
export const searchUserById = async (req, res) => {
  try {
    const { query } = req.params;
    const loggedInUserId = req.user._id;

    if (!query || !query.trim()) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const rawQuery = query.trim();
    const searchPattern = rawQuery.startsWith("@")
      ? rawQuery.slice(1)
      : rawQuery;

    const user = await User.findOne({
      _id: { $ne: loggedInUserId },
      $or: [
        { customId: { $regex: searchPattern, $options: "i" } },
        { customId: { $regex: rawQuery, $options: "i" } },
        { email: { $regex: rawQuery, $options: "i" } },
      ],
    }).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found with this User ID" });
    }

    // Add target user to my saved contacts
    await User.findByIdAndUpdate(loggedInUserId, {
      $addToSet: { contacts: user._id },
    });

    res.status(200).json(user);
  } catch (error) {
    console.error("Error in searchUserById:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET CONVERSATION HISTORY (The Chat List)
export const getChatUsers = async (req, res) => {
  try {
    const myId = req.user._id;

    // Use aggregation to find unique users messaged and order by most recent message
    const chattedUsersAgg = await Message.aggregate([
      {
        $match: {
          $or: [{ senderId: myId }, { receiverId: myId }],
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$senderId", myId] },
              "$receiverId",
              "$senderId",
            ],
          },
          lastMessageTime: { $first: "$createdAt" },
        },
      },
      {
        $sort: { lastMessageTime: -1 },
      },
    ]);

    const userIds = chattedUsersAgg.map((item) => item._id);

    const users = await User.find({
      _id: { $in: userIds },
    }).select("-password");

    // Re-order returned user documents according to most recent chat activity
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));
    const sortedUsers = userIds.map((id) => userMap.get(id.toString())).filter(Boolean);

    res.status(200).json(sortedUsers);
  } catch (error) {
    console.log("Error getting chat users:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET MESSAGES BETWEEN TWO USERS
export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 }); // Ensure chronological order

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// SEND MESSAGE
export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageUrl = image;
    if (image) {
      const hasCloudinaryKeys =
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_CLOUD_NAME !== "your_cloudinary_cloud_name" &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_KEY !== "your_cloudinary_api_key";

      if (hasCloudinaryKeys) {
        try {
          const uploadResponse = await cloudinary.uploader.upload(image, {
            folder: "nexchat",
            transformation: [
              { width: 1200, crop: "limit" },
              { quality: "auto" },
              { fetch_format: "auto" },
            ],
          });
          imageUrl = uploadResponse.secure_url;
        } catch (cloudinaryErr) {
          console.warn("Cloudinary upload failed, using direct image fallback:", cloudinaryErr.message);
        }
      }
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    await newMessage.save();

    // Real-time notification via Socket room
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// MARK AS SEEN
export const markMessagesAsSeen = async (req, res) => {
  try {
    const { id: senderId } = req.params; // The person who sent the messages
    const receiverId = req.user._id;    // Me (the one viewing them)

    await Message.updateMany(
      { senderId, receiverId, seen: false },
      { $set: { seen: true } }
    );

    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messagesSeenByReceiver", { receiverId });
    }

    res.status(200).json({ message: "Messages marked as seen" });
  } catch (error) {
    console.log("Error in markMessagesAsSeen:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};