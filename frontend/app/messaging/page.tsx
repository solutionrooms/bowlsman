'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../src/lib/axios';
import ComposeMessage from './components/ComposeMessage';
import MessageList from './components/MessageList';
import Navigation from '../components/Navigation';
import { useMessaging } from './context/MessagingContext';

interface Club {
  id: number;
  name: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
  clubs?: Club[];
}

interface Message {
  id: number;
  sender: string;
  recipient: string;
  subject: string;
  content: string;
  created_at: string;
  is_read: boolean;
  sender_name: string;
  sender_full_name: string;
  recipient_name: string;
  recipient_full_name: string;
  is_club_wide: boolean;
}

interface UserResponse {
  user: User;
  current_club: Club | null;
}

export default function MessagingPage() {
  const [activeTab, setActiveTab] = useState('inbox');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showComposeForm, setShowComposeForm] = useState(false);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState<number | null>(null);
  const { unreadCount, fetchUnreadCount } = useMessaging();

  // Use a ref to track initialization status
  const initialLoadRef = useRef(true);
  
  useEffect(() => {
    // Add isMounted pattern to prevent memory leaks
    let isMounted = true;
    
    // Only fetch on initial load 
    if (initialLoadRef.current) {
      fetchUserClubs(isMounted);
      initialLoadRef.current = false;
    }
    
    // Refresh unread count when the messaging page is loaded
    fetchUnreadCount();
    
    return () => {
      isMounted = false;
    };
  }, [fetchUnreadCount]);
  
  // Manual refresh function that can be called directly
  const refreshData = useCallback(() => {
    if (selectedClub) {
      fetchMessages(activeTab);
      fetchUnreadCount();
    }
  }, [activeTab, selectedClub, fetchUnreadCount]);

  // Replace the problematic effect with a manual approach that handles cleanup
  useEffect(() => {
    let isMounted = true;
    
    if (selectedClub && !initialLoadRef.current && isMounted) {
      // Avoid direct refreshData call which might cause render loops
      // Instead use Promise to defer execution to next tick
      Promise.resolve().then(() => {
        if (isMounted && selectedClub) {
          fetchMessages(activeTab);
          fetchUnreadCount();
        }
      });
    }
    
    return () => {
      isMounted = false;
    };
  }, [activeTab, selectedClub, fetchUnreadCount, refreshData]);

  const fetchUserClubs = async (isMounted = true) => {
    try {
      const response = await api.get<Club[]>('/users/clubs/');
      if (!isMounted) return;
      
      setClubs(response.data);
      
      // Get user data once
      const userResponse = await api.get<UserResponse>('/users/me/');
      if (!isMounted) return;
      
      let clubToSet = null;
      
      if (userResponse.data.current_club) {
        clubToSet = userResponse.data.current_club.id;
      } else if (response.data.length > 0) {
        clubToSet = response.data[0].id;
      }
      
      if (clubToSet && isMounted) {
        try {
          // Set current club on server without triggering effects
          await api.post('/club-users/set_current_club/', { club_id: clubToSet });
          if (!isMounted) return;
          
          // Set local state and manually fetch
          setSelectedClub(clubToSet);
          
          // Wait for state to update before fetching
          if (isMounted) {
            // Use a safer approach than setTimeout
            Promise.resolve().then(() => {
              if (isMounted) {
                fetchMessages(activeTab);
                fetchUnreadCount();
              }
            });
          }
        } catch (clubErr) {
          if (!isMounted) return;
          console.error('Error setting current club:', clubErr);
          setLoading(false);
          setError('Failed to set your current club. You may not have permissions.');
        }
      } else if (isMounted) {
        setLoading(false);
      }
    } catch (err) {
      if (!isMounted) return;
      console.error('Error fetching user clubs:', err);
      setLoading(false);
      setError('Failed to load your clubs. Please try again.');
    }
  };

  const handleClubChange = async (clubId: number) => {
    setLoading(true);
    setError('');
    try {
      // First update the server
      await api.post('/club-users/set_current_club/', { club_id: clubId });
      
      // Then update local state
      setSelectedClub(clubId);
      
      // Manually fetch without triggering effects
      setTimeout(() => {
        fetchMessages(activeTab);
        fetchUnreadCount();
      }, 0);
    } catch (err) {
      console.error('Error setting current club:', err);
      setLoading(false);
      setError('Failed to change club. You may not have permissions.');
    }
  };

  const fetchMessages = async (tab: string) => {
    if (!selectedClub) return;
    
    setLoading(true);
    setError('');
    try {
      const endpoint = tab === 'sent' ? 'messages/outbox' : 'messages/inbox';
      const response = await api.get<Message[]>(endpoint, {
        params: { club_id: selectedClub }
      });
      setMessages(response.data);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setMessages([]);
      setError('Failed to load messages. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    // First hide the form
    setShowComposeForm(false);
    
    // Manual refresh with setTimeout to avoid React render cycle issues
    setTimeout(() => {
      try {
        fetchMessages(activeTab);
        fetchUnreadCount(); // Refresh unread count after sending a message
      } catch (err) {
        console.error('Error refreshing messages:', err);
      }
    }, 500);
  };

  const handleMarkAsRead = async (messageId: number) => {
    console.log(`Marking message ${messageId} as read...`);
    try {
      // Use our new simplified endpoint with direct path
      const response = await api.post(`read-message/${messageId}/`);
      console.log('Mark as read response:', response);
      
      // Update the message in the local state
      setMessages(prevMessages => {
        console.log('Previous messages:', prevMessages);
        const updatedMessages = prevMessages.map(msg => 
          msg.id === messageId ? { ...msg, is_read: true } : msg
        );
        console.log('Updated messages:', updatedMessages);
        return updatedMessages;
      });
      
      // Refresh unread count
      fetchUnreadCount();
      
      return true; // Return success for components that need to know if the operation succeeded
    } catch (err: any) {
      console.error('Error marking message as read:', err);
      // Log more details about the error
      if (err.response) {
        console.error('Error response:', err.response.data);
        console.error('Error status:', err.response.status);
        console.error('Request URL:', err.config?.url);
      }
      return false; // Return failure
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentClub');
    window.location.href = '/';
  };

  return (
    <>
      <Navigation onLogout={handleLogout} />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Messaging</h1>
          
          {clubs.length > 0 && (
            <div className="flex items-center">
              <label htmlFor="club-select" className="mr-2 text-gray-700">Club:</label>
              <select
                id="club-select"
                value={selectedClub || ''}
                onChange={(e) => handleClubChange(Number(e.target.value))}
                className="mr-4 border border-gray-300 rounded px-3 py-1"
              >
                {clubs.map(club => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
              
              <button
                onClick={() => setShowComposeForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
                disabled={!selectedClub}
              >
                Compose Message
              </button>
            </div>
          )}
          
          {clubs.length === 0 && (
            <button
              onClick={() => setShowComposeForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
              disabled
            >
              Compose Message
            </button>
          )}
        </div>

        {clubs.length === 0 && !loading && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
            You are not a member of any clubs. Please join a club to use messaging.
          </div>
        )}

        {showComposeForm && selectedClub && (
          <div className="mb-6">
            <ComposeMessage
              onSend={handleSendMessage}
              onCancel={() => setShowComposeForm(false)}
              clubId={selectedClub}
            />
          </div>
        )}

        {selectedClub && (
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('inbox')}
                  className={`${
                    activeTab === 'inbox'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                >
                  Inbox
                  {unreadCount > 0 && (
                    <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-semibold py-0.5 px-2 rounded-full">
                      {unreadCount} unread
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('sent')}
                  className={`${
                    activeTab === 'sent'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Sent
                </button>
              </nav>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-10">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-2 text-gray-600">Loading messages...</p>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        ) : selectedClub ? (
          <MessageList 
            messages={messages} 
            activeTab={activeTab} 
            onMarkAsRead={handleMarkAsRead}
          />
        ) : null}
      </div>
    </>
  );
}