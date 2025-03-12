'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useMessaging } from '../context/MessagingContext';
import { formatDistanceToNow } from 'date-fns';

interface ChatListProps {
  onSelectChat: (chatId: number) => void;
  selectedChatId: number | null;
}

interface ChatItem {
  id: number;
  name: string | null;
  chat_type: 'direct' | 'group' | 'team' | 'competition';
  created_by: number;
  created_by_username: string;
  club: number;
  competition: number | null;
  created_at: string;
  updated_at: string;
  member_count: number;
  unread_count: number;
  display_name: string;
  last_message: {
    id: number;
    content: string;
    sender: string;
    created_at: string;
  } | null;
}

const ChatList: React.FC<ChatListProps> = ({ onSelectChat, selectedChatId }) => {
  const { chats, deleteChat } = useMessaging();
  const [searchQuery, setSearchQuery] = useState('');

  const getChatTypeIcon = useCallback((chatType: string) => {
    switch (chatType) {
      case 'direct':
        return '👤';
      case 'group':
        return '👥';
      case 'team':
        return '🏆';
      case 'competition':
        return '🎯';
      default:
        return '💬';
    }
  }, []);

  const formatTime = useCallback((dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return 'Unknown time';
    }
  }, []);

  const handleDeleteChat = useCallback((e: React.MouseEvent, chatId: number) => {
    e.stopPropagation(); // Prevent selecting the chat when clicking delete
    if (window.confirm('Are you sure you want to delete this chat?')) {
      deleteChat(chatId).catch(error => {
        console.error('Failed to delete chat:', error);
        alert('Failed to delete chat. Please try again.');
      });
    }
  }, [deleteChat]);

  // Filter chats based on search query
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) {
      return chats;
    }
    
    const query = searchQuery.toLowerCase();
    return chats.filter(chat => {
      const nameMatch = chat.display_name.toLowerCase().includes(query);
      const contentMatch = chat.last_message && 
        chat.last_message.content.toLowerCase().includes(query);
      return nameMatch || contentMatch;
    });
  }, [chats, searchQuery]);

  // Memoize the sorted chats to prevent unnecessary re-renders
  const sortedChats = useMemo(() => {
    return [...filteredChats].sort((a, b) => {
      // Sort by unread count first (descending)
      if (a.unread_count !== b.unread_count) {
        return b.unread_count - a.unread_count;
      }
      
      // Then by last activity (most recent first)
      const aTime = a.last_message?.created_at || a.updated_at;
      const bTime = b.last_message?.created_at || b.updated_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [filteredChats]);

  if (chats.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No chats yet. Start a new conversation!
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 border-b">
        <input
          type="text"
          placeholder="Search chats..."
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Chat list */}
      <div className="overflow-y-auto flex-grow">
        <ul className="divide-y divide-gray-200">
          {sortedChats.map((chat) => (
            <li 
              key={chat.id}
              className={`
                cursor-pointer hover:bg-gray-50 transition-colors
                ${selectedChatId === chat.id ? 'bg-blue-50' : ''}
                ${chat.unread_count > 0 ? 'font-semibold bg-orange-100' : ''}
              `}
              onClick={() => onSelectChat(chat.id)}
            >
              <div className="px-4 py-3">
                <div className="flex justify-between">
                  <div className="flex items-center">
                    <span className="text-xl mr-2">{getChatTypeIcon(chat.chat_type)}</span>
                    <span className="text-sm font-medium text-gray-900">{chat.display_name}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs text-gray-500 mr-2">
                      {chat.last_message ? formatTime(chat.last_message.created_at) : formatTime(chat.created_at)}
                    </span>
                    <button 
                      onClick={(e) => handleDeleteChat(e, chat.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete chat"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="mt-1 flex justify-between">
                  <p className="text-sm text-gray-600 truncate max-w-[70%]">
                    {chat.last_message 
                      ? `${chat.last_message.sender}: ${chat.last_message.content}` 
                      : 'No messages yet'}
                  </p>
                  
                  {chat.unread_count > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-orange-500 rounded-full">
                      {chat.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ChatList; 