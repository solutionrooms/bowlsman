'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMessaging } from '../context/MessagingContext';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';
import { getApiUrl } from '../../../src/lib/axios';

interface ChatDetailProps {
  chatId: number | null;
}

const ChatDetail: React.FC<ChatDetailProps> = ({ chatId }) => {
  const { activeChat, fetchChat, sendMessage, markChatAsRead, deleteChat, chats } = useMessaging();
  const [messageContent, setMessageContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  
  // Keep track of previous chatId to avoid unnecessary fetches
  const prevChatIdRef = useRef<number | null>(null);

  // Get the backend API URL for media files
  const apiUrl = getApiUrl();

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

  // Handle image selection
  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedImage(file);
      
      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // Clear selected image
  const clearSelectedImage = useCallback(() => {
    setSelectedImage(null);
    setPreviewUrl(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  }, []);

  // Trigger image input click
  const handleImageButtonClick = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  // Generate the full image URL using the backend API URL
  const getFullImageUrl = useCallback((imagePath: string | null) => {
    if (!imagePath) return null;
    // Handle both relative and absolute URLs
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    // Remove leading slash if present
    const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
    
    // Use the API URL but remove the '/api' part for media files
    const baseUrl = apiUrl.replace(/\/api\/?$/, '');
    return `${baseUrl}/${cleanPath}`;
  }, [apiUrl]);

  // Handle image click to expand
  const handleImageClick = useCallback((imageUrl: string) => {
    setExpandedImage(imageUrl);
  }, []);

  // Close expanded image
  const closeExpandedImage = useCallback(() => {
    setExpandedImage(null);
  }, []);

  // Memoize the send message handler
  const handleSendMessage = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!chatId || (!messageContent.trim() && !selectedImage)) return;

    // Show some feedback that we're sending
    console.log('Sending message:', messageContent, selectedImage);
    
    sendMessage(chatId, messageContent, selectedImage || undefined)
      .then(() => {
        setMessageContent('');
        clearSelectedImage();
        // Scroll to bottom after sending
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      })
      .catch(error => {
        console.error('Error sending message:', error);
        setError('Failed to send message. Please try again.');
      });
  }, [chatId, messageContent, sendMessage, selectedImage, clearSelectedImage]);

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

  // Add a new function to handle chat deletion
  const handleDeleteChat = useCallback(() => {
    if (!chatId) return;
    
    if (window.confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
      deleteChat(chatId).catch(error => {
        console.error('Error deleting chat:', error);
        setError('Could not delete the chat. Please try again later.');
      });
    }
  }, [chatId, deleteChat]);

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
          <h2 className="text-xl font-semibold">
            {activeChat.display_name}
          </h2>
          <p className="text-sm text-gray-500">
            {activeChat.members.length} members • Created {formatTime(activeChat.created_at)}
          </p>
        </div>
        <div className="flex space-x-2">
          <button 
            className="text-blue-600 hover:text-blue-800"
            onClick={() => setShowMembers(!showMembers)}
          >
            {showMembers ? 'Hide Members' : 'Show Members'}
          </button>
          <button 
            className="text-red-600 hover:text-red-800"
            onClick={handleDeleteChat}
            title="Delete chat"
          >
            Delete
          </button>
        </div>
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
                {member.user_details.avatar ? (
                  <img 
                    src={getFullImageUrl(member.user_details.avatar) || ''} 
                    alt={member.user_details.full_name}
                    className="w-6 h-6 rounded-full object-cover mr-2" 
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center mr-2">
                    <span className="text-xs font-medium text-gray-600">
                      {member.user_details.full_name.substring(0, 1).toUpperCase()}
                    </span>
                  </div>
                )}
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
              // Get full image URL if image_url exists
              const fullImageUrl = getFullImageUrl(message.image_url);
              
              return (
                <div 
                  key={message.id} 
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isCurrentUser && (
                    <div className="mr-2 flex-shrink-0">
                      {message.sender_details.avatar ? (
                        <img 
                          src={getFullImageUrl(message.sender_details.avatar) || ''}
                          alt={message.sender_details.full_name}
                          className="w-8 h-8 rounded-full object-cover" 
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">
                            {message.sender_details.full_name.substring(0, 1).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <div 
                    className={`max-w-[75%] rounded-lg px-4 py-2 ${
                      isCurrentUser 
                        ? 'bg-blue-600 text-white rounded-br-none' 
                        : 'bg-white border border-gray-200 rounded-bl-none'
                    }`}
                  >
                    <div className="flex justify-between items-baseline mb-1">
                      <div className="flex items-center">
                        <span className={`font-medium text-sm ${isCurrentUser ? 'text-blue-100' : 'text-gray-900'}`}>
                          {message.sender_details.full_name}
                        </span>
                        {message.sender_details.is_admin && (
                          <span className="ml-1 text-xs bg-blue-100 text-blue-800 px-1 rounded">Admin</span>
                        )}
                        {message.sender_details.club_role && message.sender_details.club_role !== "member" && (
                          <span className="ml-1 text-xs bg-green-100 text-green-800 px-1 rounded">{message.sender_details.club_role}</span>
                        )}
                      </div>
                      <span className={`text-xs ml-2 ${isCurrentUser ? 'text-blue-200' : 'text-gray-500'}`}>
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                    {message.content && (
                      <p className={`${isCurrentUser ? 'text-white' : 'text-gray-800'}`}>
                        {message.content}
                      </p>
                    )}
                    {fullImageUrl && (
                      <div className="mt-2">
                        <img 
                          src={fullImageUrl} 
                          alt="Message attachment" 
                          className="max-w-full h-auto rounded cursor-pointer"
                          style={{ maxHeight: '200px' }}
                          onClick={() => handleImageClick(fullImageUrl)}
                        />
                      </div>
                    )}
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
        {/* Preview of selected image */}
        {previewUrl && (
          <div className="mb-3 relative">
            <img 
              src={previewUrl} 
              alt="Selected image" 
              className="max-h-32 max-w-full rounded"
            />
            <button
              type="button"
              onClick={clearSelectedImage}
              className="absolute top-1 right-1 bg-gray-800 bg-opacity-70 text-white rounded-full p-1"
              aria-label="Remove image"
            >
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex items-center">
          <button
            type="button"
            onClick={handleImageButtonClick}
            className="mr-2 p-2 text-gray-500 hover:text-blue-600 focus:outline-none"
            aria-label="Attach image"
          >
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <input
            type="file"
            ref={imageInputRef}
            onChange={handleImageChange}
            accept="image/*"
            className="hidden"
          />
          <input
            type="text"
            value={messageContent}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 border border-gray-300 rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!messageContent.trim() && !selectedImage}
            className="bg-blue-600 text-white px-4 py-2 rounded-r-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-300"
          >
            Send
          </button>
        </form>
      </div>

      {/* Image Modal for expanded view */}
      {expandedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
          onClick={closeExpandedImage}
        >
          <div className="max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
            <img 
              src={expandedImage} 
              alt="Expanded image" 
              className="max-w-full max-h-[90vh] object-contain rounded"
            />
            <button
              className="absolute top-4 right-4 bg-gray-800 bg-opacity-70 text-white rounded-full p-2"
              onClick={closeExpandedImage}
            >
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatDetail; 