import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  chatUsers: [], // Users you have an existing conversation with
  contacts: [],  // All potential users
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isTyping: false,
  typingUser: null,

  // Fetch all users for the "Contacts" tab
  getContacts: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ contacts: res.data });
    } catch (error) {
      toast.error("Failed to load contacts");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  // Fetch only users with message history for "Chats" tab
  getChatUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/chats");
      set({ chatUsers: res.data });
    } catch (error) {
      console.error("Error fetching chat history:", error);
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
      toast.error("Could not load messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      set({ messages: [...messages, res.data] });
      
      // Refresh chat list so the most recent conversation moves to top
      get().getChatUsers(); 
    } catch (error) {
      toast.error(error.response?.data?.message || "Message failed to send");
    }
  },

  markMessagesAsSeen: async (senderId) => {
    try {
      await axiosInstance.put(`/messages/seen/${senderId}`);
    } catch (error) {
      console.error("Error marking messages as seen", error);
    }
  },

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    // Clean up existing listeners to prevent memory leaks/duplicates
    get().unsubscribeFromMessages();

    socket.on("newMessage", (newMessage) => {
      const { selectedUser, getChatUsers } = get();
      
      // Always refresh the chat list order when any new message arrives
      getChatUsers();

      // Only add to message array if it's from the person we are currently talking to
      if (selectedUser && newMessage.senderId === selectedUser._id) {
        set({ messages: [...get().messages, newMessage] });
      }
    });

    socket.on("messagesSeenByReceiver", () => {
      const { selectedUser, messages } = get();
      if (!selectedUser) return;

      // Update local state: mark all messages sent by me to this user as 'seen'
      const updatedMessages = messages.map((msg) =>
        msg.receiverId === selectedUser._id ? { ...msg, seen: true } : msg
      );
      set({ messages: updatedMessages });
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
    if (!socket) return;
    socket.off("newMessage");
    socket.off("messagesSeenByReceiver");
    socket.off("userTyping");
    socket.off("userStoppedTyping");
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));