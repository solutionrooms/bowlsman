'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMessaging } from '../context/MessagingContext';
import { formatDistanceToNow } from 'date-fns';

interface ChatDetailProps {
  chatId: number | null;
}

const ChatDetail: React.FC<ChatDetailProps> = ({ chatId }) => {
  const { activeChat, fetchChat, sendMessage, markChatAsRead } = useMessaging();
  const [messageContent, setMessageContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showMembers, setShowMembers] = useState(false);
  
  // Keep track of previous chatId to avoid unnecessary fetches
  const prevChatIdRef = useRef<number | null>(null);

  // Fetch chat data when chatId changes
  useEffect(() => {
    // Only fetch if chatId is different from previous
    if (chatId && chatId !== prevChatIdRef.current) {
      setLoading(true);
      setError(null);
      
      fetchChat(chatId)
        .then(() => {
          // Mark chat as read when opened
          // Don't wait for this to complete to avoid blocking the UI
          markChatAsRead(chatId).catch(err => {
            console.error('Error marking chat as read:', err);
            // Continue anyway - this is not critical
          });
        })
        .catch(err => {
          console.error('Error fetching chat:', err);
          setError('Could not load chat. It may have been deleted or you may not have permission to view it.');
        })
        .finally(() => {
          setLoading(false);
        });
      
      // Update the ref to current chatId
      prevChatIdRef.current = chatId;
    }
  }, [chatId, fetchChat, markChatAsRead]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages?.length]); // Only depend on the length of messages

  // Memoize the send message handler
  const handleSendMessage = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!chatId || !messageContent.trim()) return;

    // Show some feedback that we're sending
    console.log('Sending message:', messageContent);
    
    sendMessage(chatId, messageContent)
      .then(() => {
        setMessageContent('');
        // Scroll to bottom after sending
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      })
      .catch(error => {
        console.error('Error sending message:', error);
        setError('Failed to send message. Please try again.');
      });
  }, [chatId, messageContent, sendMessage]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageContent(e.target.value);
  }, []);

  const formatTime = useCallback((dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return 'Unknown time';
    }
  }, []);

  if (!chatId) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center text-gray-500">
          <p className="text-xl mb-2">👋 Welcome to Chat</p>
          <p>Select a conversation or start a new one</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center text-red-500 p-4 max-w-md">
          <p className="text-xl mb-2">⚠️ Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!activeChat) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center text-gray-500">
          <p className="text-xl mb-2">Chat not found</p>
          <p>The selected chat could not be loaded</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">
            {activeChat.name || 
              (activeChat.chat_type === 'direct' && activeChat.members.length === 2 
                ? `Chat with ${activeChat.members.find(m => m.user !== activeChat.created_by)?.user_details.full_name || 'User'}`
                : `${activeChat.chat_type.charAt(0).toUpperCase() + activeChat.chat_type.slice(1)} Chat`)}
          </h2>
          <p className="text-sm text-gray-500">
            {activeChat.members.length} members • Created {formatTime(activeChat.created_at)}
          </p>
        </div>
        <button 
          className="text-blue-600 hover:text-blue-800"
          onClick={() => setShowMembers(!showMembers)}
        >
          {showMembers ? 'Hide Members' : 'Show Members'}
        </button>
      </div>

      {/* Members list (collapsible) */}
      {showMembers && (
        <div className="bg-gray-50 p-4 border-b border-gray-200">
          <h3 className="font-medium mb-2">Members</h3>
          <div className="flex flex-wrap gap-2">
            {activeChat.members.map((member) => (
              <div 
                key={member.id} 
                className="bg-white px-3 py-1 rounded-full text-sm border border-gray-200 flex items-center"
              >
                <span>{member.user_details.full_name}</span>
                {member.is_admin && (
                  <span className="ml-1 text-xs bg-blue-100 text-blue-800 px-1 rounded">Admin</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {activeChat.messages.length === 0 ? (
          <div className="text-center text-gray-500 my-8">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeChat.messages.map((message) => {
              const isCurrentUser = message.sender_details.id === activeChat.created_by;
              
              return (
                <div 
                  key={message.id} 
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[75%] rounded-lg px-4 py-2 ${
                      isCurrentUser 
                        ? 'bg-blue-600 text-white rounded-br-none' 
                        : 'bg-white border border-gray-200 rounded-bl-none'
                    }`}
                  >
                    <div className="flex justify-between items-baseline mb-1">
                      <span className={`font-medium text-sm ${isCurrentUser ? 'text-blue-100' : 'text-gray-900'}`}>
                        {message.sender_details.full_name}
                      </span>
                      <span className={`text-xs ml-2 ${isCurrentUser ? 'text-blue-200' : 'text-gray-500'}`}>
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                    <p className={`${isCurrentUser ? 'text-white' : 'text-gray-800'}`}>
                      {message.content}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={handleSendMessage} className="flex">
          <input
            type="text"
            value={messageContent}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 border border-gray-300 rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!messageContent.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-r-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-300"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatDetail; 