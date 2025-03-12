'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import api, { getApiUrl } from '../../../src/lib/axios';

interface Chat {
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

interface ChatMember {
  id: number;
  chat: number;
  user: number;
  user_details: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string;
    avatar?: string;
  };
  is_admin: boolean;
  joined_at: string;
  last_read_at: string | null;
}

interface ChatMessage {
  id: number;
  chat: number;
  sender: number;
  sender_details: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string;
    avatar?: string;
    is_admin?: boolean;
    club_role?: string;
  };
  content: string;
  image: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatDetail extends Chat {
  members: ChatMember[];
  messages: ChatMessage[];
}

interface Message {
  id: number;
  sender: number;
  recipient: number | null;
  subject: string;
  content: string;
  created_at: string;
  is_read: boolean;
  sender_name: string;
  sender_full_name: string;
  recipient_name: string | null;
  recipient_full_name: string | null;
  is_club_wide: boolean;
}

// Define response types for API calls
interface UnreadCountResponse {
  unread_count: number;
}

interface MessagingContextType {
  unreadCount: number;
  fetchUnreadCount: (clubId: number) => Promise<void>;
  chats: Chat[];
  activeChat: ChatDetail | null;
  fetchChats: (clubId: number) => Promise<void>;
  fetchChat: (chatId: number) => Promise<void>;
  createChat: (data: any) => Promise<Chat>;
  findExistingChat: (clubId: number, userId: number) => Promise<number | null>;
  sendMessage: (chatId: number, content: string, image?: File) => Promise<ChatMessage>;
  markChatAsRead: (chatId: number) => Promise<void>;
  addMemberToChat: (chatId: number, userId: number) => Promise<void>;
  removeMemberFromChat: (chatId: number, userId: number) => Promise<void>;
  deleteChat: (chatId: number) => Promise<void>;
  // Legacy message methods
  messages: Message[];
  fetchMessages: (clubId: number) => Promise<void>;
  sendLegacyMessage: (data: any) => Promise<Message>;
  markMessageAsRead: (messageId: number) => Promise<void>;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

export const MessagingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<ChatDetail | null>(null);

  const fetchUnreadCount = useCallback(async (clubId: number) => {
    try {
      const response = await api.get<UnreadCountResponse>(`/api/unread-count/?club_id=${clubId}`);
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, []);

  const fetchMessages = useCallback(async (clubId: number) => {
    try {
      const response = await api.get<Message[]>(`/api/messages/?club_id=${clubId}`);
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, []);

  const sendLegacyMessage = useCallback(async (data: any): Promise<Message> => {
    try {
      const response = await api.post<Message>('/api/messages/', data);
      // Update messages list with the new message
      setMessages(prevMessages => [response.data, ...prevMessages]);
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }, []);

  const markMessageAsRead = useCallback(async (messageId: number): Promise<void> => {
    try {
      await api.post(`/api/read-message/${messageId}/`);
      // Update the message in the list
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === messageId ? { ...msg, is_read: true } : msg
        )
      );
      // Update unread count
      setUnreadCount(prevCount => Math.max(0, prevCount - 1));
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }, []);

  // New chat methods
  const fetchChats = useCallback(async (clubId: number) => {
    try {
      const response = await api.get<Chat[]>(`/api/chats/?club_id=${clubId}`);
      setChats(response.data);
    } catch (error) {
      console.error('Error fetching chats:', error);
    }
  }, []);

  const fetchChat = useCallback(async (chatId: number) => {
    if (!chatId) {
      console.error('No chat ID provided to fetchChat');
      return;
    }
    
    try {
      console.log(`Fetching chat ${chatId}`);
      
      // Get the current club ID from localStorage
      let clubId = null;
      if (typeof window !== 'undefined') {
        const storedClub = localStorage.getItem('currentClub');
        if (storedClub) {
          try {
            const club = JSON.parse(storedClub);
            clubId = club.id;
          } catch (e) {
            console.error('Error parsing current club:', e);
          }
        }
      }
      
      // Add club_id as a query parameter to ensure proper permissions
      const response = await api.get<ChatDetail>(
        `/api/chats/${chatId}/`, 
        { params: { club_id: clubId } }
      );
      
      setActiveChat(response.data);
    } catch (error) {
      console.error('Error fetching chat details:', error);
      // Clear the active chat to prevent showing stale data
      setActiveChat(null);
      throw error;
    }
  }, []);

  // New function to find existing direct chat with a user
  const findExistingChat = useCallback(async (clubId: number, userId: number): Promise<number | null> => {
    try {
      console.log(`Searching for existing chat between club ${clubId} and user ${userId}`);
      
      // First, get all chats for the club
      const response = await api.get<Chat[]>(`/api/chats/?club_id=${clubId}`);
      const allChats = response.data;
      console.log(`Found ${allChats.length} total chats, filtering to direct chats`);
      
      // Filter to direct chats
      const directChats = allChats.filter(chat => chat.chat_type === 'direct');
      console.log(`Found ${directChats.length} direct chats`);
      
      // For each direct chat, check if it's with the specified user
      for (const chat of directChats) {
        console.log(`Checking chat ${chat.id}`);
        try {
          // Get detailed chat info to see the members
          const detailResponse = await api.get<ChatDetail>(`/api/chats/${chat.id}/`);
          const chatDetail = detailResponse.data;
          
          // Check if the user is a member of this chat
          const members = chatDetail.members || [];
          console.log(`Chat ${chat.id} has ${members.length} members`);
          
          // Log member IDs for debugging
          const memberIds = members.map(m => 
            typeof m.user === 'number' ? m.user : 
            (m.user_details ? m.user_details.id : 'unknown')
          );
          console.log(`Member IDs in chat ${chat.id}:`, memberIds);
          
          const userIsMember = members.some(member => {
            // Check all possible ways the user ID might be represented
            if (member.user === userId) return true;
            if (member.user_details && member.user_details.id === userId) return true;
            return false;
          });
          
          if (userIsMember) {
            console.log(`Found existing chat ${chat.id} with user ${userId}`);
            return chat.id;
          }
        } catch (err) {
          console.error(`Error checking chat ${chat.id} for user ${userId}:`, err);
          // Continue to next chat
        }
      }
      
      // No existing chat found
      console.log(`No existing chat found between club ${clubId} and user ${userId}`);
      return null;
    } catch (err) {
      console.error('Error finding existing chat:', err);
      return null;
    }
  }, []);

  const createChat = useCallback(async (data: any): Promise<Chat> => {
    // If there's a club_id and this is a direct chat with one member, 
    // first check if a chat already exists
    if (data.club_id && data.chat_type === 'direct' && 
        Array.isArray(data.members) && data.members.length === 1) {
      
      const userId = data.members[0];
      console.log(`Checking for existing chat before creating: club ${data.club_id}, user ${userId}`);
      const existingChatId = await findExistingChat(data.club_id, userId);
      
      if (existingChatId) {
        // If a chat already exists, fetch its details
        try {
          const response = await api.get<Chat>(`/api/chats/${existingChatId}/`);
          const existingChat = response.data;
          
          // Return the existing chat instead of creating a new one
          console.log('Found existing chat, returning instead of creating new:', existingChat);
          return existingChat;
        } catch (e) {
          console.error('Error fetching existing chat:', e);
          // Fall through to create a new chat if we can't fetch the existing one
        }
      }
    }
    
    // No existing chat found or couldn't fetch it, create a new one
    try {
      console.log('Creating new chat with data:', data);
      const response = await api.post<Chat>('/api/chats/', data);
      // Update chats list with the new chat
      setChats(prevChats => [response.data, ...prevChats]);
      return response.data;
    } catch (error: any) {
      console.error('Error creating chat:', error);
      
      // If there's a duplicate key error, it means the chat already exists
      // This is a race condition - the chat might have been created between our check and create
      if (error.response && 
          (error.response.status === 400 || error.response.status === 409) && 
          error.response.data && 
          typeof error.response.data.error === 'string' && 
          (error.response.data.error.includes('already exists') || 
           error.response.data.error.includes('duplicate key'))) {
        
        console.log('Got duplicate key error, retrying to find existing chat');
        
        // Try again to find the existing chat
        if (data.club_id && data.chat_type === 'direct' && 
            Array.isArray(data.members) && data.members.length === 1) {
          
          const userId = data.members[0];
          // Retry the search with a small delay to allow any in-progress operations to complete
          await new Promise(resolve => setTimeout(resolve, 500));
          const retryExistingChatId = await findExistingChat(data.club_id, userId);
          
          if (retryExistingChatId) {
            try {
              const response = await api.get<Chat>(`/api/chats/${retryExistingChatId}/`);
              console.log('Successfully found existing chat after duplicate key error:', response.data);
              return response.data;
            } catch (e) {
              console.error('Error fetching existing chat after duplicate key error:', e);
            }
          }
        }
      }
      
      // If we couldn't handle the error or find an existing chat, rethrow
      throw error;
    }
  }, [findExistingChat]);

  const sendMessage = useCallback(async (chatId: number, content: string, image?: File): Promise<ChatMessage> => {
    if (!chatId || (!content.trim() && !image)) {
      throw new Error('Chat ID and either content or image are required');
    }
    
    try {
      console.log(`Sending message to chat ${chatId}: ${content}`);
      if (image) {
        console.log("Uploading image:", image);
      }
      
      // Get the current club ID from localStorage
      let clubId = null;
      if (typeof window !== 'undefined') {
        const storedClub = localStorage.getItem('currentClub');
        if (storedClub) {
          try {
            const club = JSON.parse(storedClub);
            clubId = club.id;
          } catch (e) {
            console.error('Error parsing current club:', e);
          }
        }
      }
      
      // Create FormData if we have an image
      let data;
      let config: any = {};
      
      if (image) {
        data = new FormData();
        // Ensure content is not empty - use a space if blank
        data.append('content', content.trim() ? content : ' ');
        data.append('image', image);
        if (clubId) {
          data.append('club_id', clubId.toString());
        }
        
        // DO NOT set Content-Type for FormData - browser will set it with boundary
        config = {
          headers: {
            'Content-Type': undefined // Let browser set the correct Content-Type with boundary
          }
        };
      } else {
        data = { content, club_id: clubId };
        config = {
          headers: { 'Content-Type': 'application/json' }
        };
      }
      
      // The correct URL format for nested resources in DRF
      const response = await api.post<ChatMessage>(
        `/api/chats/${chatId}/messages/`, 
        data,
        config
      );
      
      // Update active chat with the new message
      if (activeChat && activeChat.id === chatId) {
        setActiveChat(prevChat => {
          if (!prevChat) return null;
          return {
            ...prevChat,
            messages: [...prevChat.messages, response.data]
          };
        });
      } else {
        // If the active chat isn't loaded yet, fetch it
        try {
          await fetchChat(chatId);
        } catch (err) {
          console.error('Error fetching chat after sending message:', err);
          // Continue anyway - the message was sent successfully
        }
      }
      
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }, [activeChat, fetchChat]);

  const markChatAsRead = useCallback(async (chatId: number): Promise<void> => {
    if (!chatId) return;
    
    try {
      console.log(`Marking chat ${chatId} as read`);
      
      // Get the current club ID from localStorage
      let clubId = null;
      if (typeof window !== 'undefined') {
        const storedClub = localStorage.getItem('currentClub');
        if (storedClub) {
          try {
            const club = JSON.parse(storedClub);
            clubId = club.id;
          } catch (e) {
            console.error('Error parsing current club:', e);
          }
        }
      }
      
      // Make API call with the club_id parameter
      await api.post(`/api/chats/${chatId}/mark_as_read/`, {}, {
        params: { club_id: clubId }
      });
      
      // Update the chat in the list
      setChats(prevChats =>
        prevChats.map(chat =>
          chat.id === chatId ? { ...chat, unread_count: 0 } : chat
        )
      );
      
      // Recalculate total unread count
      const totalUnread = chats.reduce((total, chat) => {
        return total + (chat.id === chatId ? 0 : chat.unread_count);
      }, 0);
      
      setUnreadCount(totalUnread);
    } catch (error) {
      console.error('Error marking chat as read:', error);
      // Don't throw the error to prevent UI disruption
    }
  }, [chats]);

  const addMemberToChat = useCallback(async (chatId: number, userId: number): Promise<void> => {
    try {
      await api.post(`/api/chats/${chatId}/add_member/`, { user_id: userId });
      
      // Refresh the active chat to get updated members
      if (activeChat && activeChat.id === chatId) {
        fetchChat(chatId);
      }
    } catch (error) {
      console.error('Error adding member to chat:', error);
      throw error;
    }
  }, [activeChat, fetchChat]);

  const removeMemberFromChat = useCallback(async (chatId: number, userId: number): Promise<void> => {
    try {
      await api.post(`/api/chats/${chatId}/remove_member/`, { user_id: userId });
      
      // Refresh the active chat to get updated members
      if (activeChat && activeChat.id === chatId) {
        fetchChat(chatId);
      }
    } catch (error) {
      console.error('Error removing member from chat:', error);
      throw error;
    }
  }, [activeChat, fetchChat]);

  const deleteChat = useCallback(async (chatId: number): Promise<void> => {
    if (!chatId) return;
    
    try {
      console.log(`Deleting chat ${chatId}`);
      
      // Get the current club ID from localStorage
      let clubId = null;
      if (typeof window !== 'undefined') {
        const storedClub = localStorage.getItem('currentClub');
        if (storedClub) {
          try {
            const club = JSON.parse(storedClub);
            clubId = club.id;
          } catch (e) {
            console.error('Error parsing current club:', e);
          }
        }
      }
      
      // Make a direct API call with the necessary club_id parameter
      await api.delete(`/api/chats/${chatId}/`, {
        params: { club_id: clubId }
      });
      
      // Remove the chat from the list
      setChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
      
      // If the deleted chat was the active chat, clear it
      if (activeChat && activeChat.id === chatId) {
        setActiveChat(null);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  }, [activeChat]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(() => ({
    unreadCount,
    fetchUnreadCount,
    messages,
    fetchMessages,
    sendLegacyMessage,
    markMessageAsRead,
    chats,
    activeChat,
    fetchChats,
    fetchChat,
    createChat,
    findExistingChat,
    sendMessage,
    markChatAsRead,
    addMemberToChat,
    removeMemberFromChat,
    deleteChat
  }), [
    unreadCount,
    fetchUnreadCount,
    messages,
    fetchMessages,
    sendLegacyMessage,
    markMessageAsRead,
    chats,
    activeChat,
    fetchChats,
    fetchChat,
    createChat,
    findExistingChat,
    sendMessage,
    markChatAsRead,
    addMemberToChat,
    removeMemberFromChat,
    deleteChat
  ]);

  return (
    <MessagingContext.Provider value={contextValue}>
      {children}
    </MessagingContext.Provider>
  );
};

export const useMessaging = () => {
  const context = useContext(MessagingContext);
  if (context === undefined) {
    throw new Error('useMessaging must be used within a MessagingProvider');
  }
  return context;
}; 