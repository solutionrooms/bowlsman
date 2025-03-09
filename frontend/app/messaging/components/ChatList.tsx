'use client';

import React, { useCallback, useMemo } from 'react';
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
  last_message: {
    id: number;
    content: string;
    sender: string;
    created_at: string;
  } | null;
}

const ChatList: React.FC<ChatListProps> = ({ onSelectChat, selectedChatId }) => {
  const { chats } = useMessaging();

  const getChatName = useCallback((chat: ChatItem) => {
    if (chat.name) return chat.name;
    
    // For direct chats without a name, use the other person's name
    if (chat.chat_type === 'direct' && chat.member_count === 2) {
      return `Chat with ${chat.last_message?.sender || 'User'}`;
    }
    
    // For other chat types
    switch (chat.chat_type) {
      case 'team':
        return 'Team Chat';
      case 'competition':
        return 'Competition Chat';
      case 'group':
        return `Group (${chat.member_count} members)`;
      default:
        return `Chat #${chat.id}`;
    }
  }, []);

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

  // Memoize the sorted chats to prevent unnecessary re-renders
  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      // Sort by unread count first (descending)
      if (a.unread_count !== b.unread_count) {
        return b.unread_count - a.unread_count;
      }
      
      // Then by last activity (most recent first)
      const aTime = a.last_message?.created_at || a.updated_at;
      const bTime = b.last_message?.created_at || b.updated_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [chats]);

  if (chats.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No chats yet. Start a new conversation!
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      <ul className="divide-y divide-gray-200">
        {sortedChats.map((chat) => (
          <li 
            key={chat.id}
            className={`
              cursor-pointer hover:bg-gray-50 transition-colors
              ${selectedChatId === chat.id ? 'bg-blue-50' : ''}
              ${chat.unread_count > 0 ? 'font-semibold' : ''}
            `}
            onClick={() => onSelectChat(chat.id)}
          >
            <div className="px-4 py-3">
              <div className="flex justify-between">
                <div className="flex items-center">
                  <span className="text-xl mr-2">{getChatTypeIcon(chat.chat_type)}</span>
                  <span className="text-sm font-medium text-gray-900">{getChatName(chat)}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {chat.last_message ? formatTime(chat.last_message.created_at) : formatTime(chat.created_at)}
                </span>
              </div>
              
              <div className="mt-1 flex justify-between">
                <p className="text-sm text-gray-600 truncate max-w-[70%]">
                  {chat.last_message 
                    ? `${chat.last_message.sender}: ${chat.last_message.content}` 
                    : 'No messages yet'}
                </p>
                
                {chat.unread_count > 0 && (
                  <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">
                    {chat.unread_count}
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ChatList; 