import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isTyping: false,
  typingUser: null,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  markMessagesAsSeen: async (senderId) => {
    try {
      await axiosInstance.put(`/messages/seen/${senderId}`);
    } catch (error) {
      console.log("Error marking messages as seen", error);
    }
  },
  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

subscribeToMessages: () => {
  const socket = useAuthStore.getState().socket;

if (!socket) {
  console.log("Socket not ready yet ❌");
  return;
}

  // prevent duplicates
  socket.off("newMessage");
  socket.off("messagesSeenByReceiver");
  socket.off("userTyping");
  socket.off("userStoppedTyping");

  socket.on("newMessage", (newMessage) => {
    const selectedUser = get().selectedUser;

    if (!selectedUser) return;

    const isFromCurrentChat =
      newMessage.senderId === selectedUser._id;

    if (!isFromCurrentChat) return;

    set({ messages: [...get().messages, newMessage] });
  });

  // 🔥 IMPORTANT FIX (NO axios refetch)
socket.on("messagesSeenByReceiver", async () => {
  const selectedUser = get().selectedUser;
  const authUser = useAuthStore.getState().authUser;

  if (!selectedUser) return;

  try {
    const res = await axiosInstance.get(
      `/messages/${selectedUser._id}`
    );

    // 🔥 IMPORTANT: replace array reference completely
    set({ messages: [...res.data] });

  } catch (error) {
    console.log("seen refresh error", error);
  }
});

  socket.on("userTyping", ({ senderName }) => {
    set({ isTyping: true, typingUser: senderName });
  });

  socket.on("userStoppedTyping", () => {
    set({ isTyping: false, typingUser: null });
  });
},

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
    socket.off("messagesSeenByReceiver");
    socket.off("userTyping");
    socket.off("userStoppedTyping");
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));