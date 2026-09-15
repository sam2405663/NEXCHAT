import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users, MessageCircle, Search, UserPlus } from "lucide-react";
import toast from "react-hot-toast";

const Sidebar = () => {
  const {
    chatUsers,
    contacts,
    selectedUser,
    setSelectedUser,
    isUsersLoading,
    getChatUsers,
    getContacts,
    searchUserById,
    subscribeToMessages,
    unsubscribeFromMessages,
  } = useChatStore();

  const { onlineUsers } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [activeTab, setActiveTab] = useState("chats");
  const [searchIdQuery, setSearchIdQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Initial data fetch and socket subscription
  useEffect(() => {
    getChatUsers();
    getContacts();
    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [getChatUsers, getContacts, subscribeToMessages, unsubscribeFromMessages]);

  const handleSearchUser = async (e) => {
    e.preventDefault();
    if (!searchIdQuery.trim()) return;

    setIsSearching(true);
    const user = await searchUserById(searchIdQuery.trim());
    setIsSearching(false);

    if (user) {
      setSelectedUser(user);
      toast.success(`Chat started with ${user.fullName}`);
      setSearchIdQuery("");
    }
  };

  // Determine which list to show based on the active tab
  const usersToShow = activeTab === "chats" ? chatUsers : contacts;

  // Apply online filter
  const filteredUsers = showOnlineOnly
    ? usersToShow.filter((user) => onlineUsers.includes(user._id))
    : usersToShow;

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-20 lg:w-80 border-r border-base-300 flex flex-col transition-all duration-200">
      {/* Header & Brand */}
      <div className="border-b border-base-300 w-full p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="size-6 text-primary" />
          <span className="font-bold text-lg hidden lg:block">NexChat</span>
        </div>

        {/* User ID Search Form */}
        <form onSubmit={handleSearchUser} className="hidden lg:flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-2.5 top-2.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by User ID (@tag)..."
              value={searchIdQuery}
              onChange={(e) => setSearchIdQuery(e.target.value)}
              className="w-full input input-bordered input-xs pl-8 py-3 rounded-lg text-xs"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchIdQuery.trim()}
            className="btn btn-primary btn-xs h-7 px-2 flex items-center gap-1"
          >
            <UserPlus size={14} />
            <span>Find</span>
          </button>
        </form>

        {/* Tab Switcher */}
        <div className="flex bg-base-200 p-1 rounded-lg gap-1">
          <button
            onClick={() => setActiveTab("chats")}
            className={`flex items-center justify-center gap-2 py-1.5 px-3 flex-1 rounded-md transition-all text-xs font-medium ${
              activeTab === "chats" 
                ? "bg-primary text-primary-content shadow-sm" 
                : "hover:bg-base-300 text-base-content/70"
            }`}
          >
            <MessageCircle size={16} />
            <span className="hidden lg:block">Chats</span>
          </button>

          <button
            onClick={() => setActiveTab("contacts")}
            className={`flex items-center justify-center gap-2 py-1.5 px-3 flex-1 rounded-md transition-all text-xs font-medium ${
              activeTab === "contacts" 
                ? "bg-primary text-primary-content shadow-sm" 
                : "hover:bg-base-300 text-base-content/70"
            }`}
          >
            <Users size={16} />
            <span className="hidden lg:block">Contacts</span>
          </button>
        </div>

        {/* Online Filter Toggle */}
        <div className="hidden lg:flex items-center justify-between px-1 pt-1">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="checkbox checkbox-xs checkbox-primary"
            />
            <span className="text-xs font-medium group-hover:text-primary transition-colors">
              Online Only
            </span>
          </label>
          <span className="text-[10px] bg-base-300 px-2 py-0.5 rounded-full text-zinc-500">
            {Math.max(0, onlineUsers.length - 1)} active
          </span>
        </div>
      </div>

      {/* User List Area */}
      <div className="overflow-y-auto w-full flex-1">
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <button
              key={user._id}
              onClick={() => setSelectedUser(user)}
              className={`
                w-full p-3 flex items-center gap-3
                hover:bg-base-200 transition-all border-l-4
                ${
                  selectedUser?._id === user._id
                    ? "bg-base-200 border-primary"
                    : "border-transparent"
                }
              `}
            >
              {/* Avatar Section */}
              <div className="relative flex-shrink-0">
                <img
                  src={user.profilePic || "/avatar.png"}
                  alt={user.fullName}
                  className="size-11 object-cover rounded-full border border-base-300"
                />
                {onlineUsers.includes(user._id) && (
                  <span className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full ring-2 ring-base-100" />
                )}
              </div>

              {/* User Details */}
              <div className="hidden lg:block text-left min-w-0 flex-1">
                <div className="font-semibold truncate text-sm flex items-center justify-between">
                  <span className="truncate">{user.fullName}</span>
                </div>
                {user.customId && (
                  <div className="text-[11px] text-primary/80 font-mono truncate">
                    {user.customId}
                  </div>
                )}
                <div className={`text-[10px] truncate ${onlineUsers.includes(user._id) ? "text-green-500 font-medium" : "text-zinc-500"}`}>
                  {onlineUsers.includes(user._id) ? "Active now" : "Offline"}
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4 space-y-2">
            <p className="text-zinc-500 text-sm">
              {showOnlineOnly ? "No online users found" : `No ${activeTab} yet`}
            </p>
            <p className="text-xs text-zinc-400 hidden lg:block">
              Use the search bar above to start a chat with someone's User ID.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;