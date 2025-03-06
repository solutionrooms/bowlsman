'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../src/lib/axios';
import ComposeMessage from './components/ComposeMessage';
import MessageList from './components/MessageList';
import Navigation from '../components/Navigation';

interface Club {
  id: number;
  name: string;
}

export default function MessagingPage() {
  const [activeTab, setActiveTab] = useState('inbox');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showComposeForm, setShowComposeForm] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState<number | null>(null);

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
    
    return () => {
      isMounted = false;
    };
  }, []);
  
  // Manual refresh function that can be called directly
  const refreshData = useCallback(() => {
    if (selectedClub) {
      fetchMessages(activeTab);
      fetchUnreadCount();
    }
  }, [activeTab, selectedClub]);

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
  }, [activeTab, selectedClub]);

  const fetchUserClubs = async (isMounted = true) => {
    try {
      const response = await api.get('/users/clubs/');
      if (!isMounted) return;
      
      setClubs(response.data);
      
      // Get user data once
      const userResponse = await api.get('/users/me/');
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
      const endpoint = `/messages/${tab === 'sent' ? 'outbox' : 'inbox'}`;
      const response = await api.get(endpoint, {
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

  const fetchUnreadCount = async () => {
    if (!selectedClub) return;
    
    try {
      const response = await api.get('/messages/unread/', {
        params: { club_id: selectedClub }
      });
      setUnreadCount(response.data.length);
    } catch (err) {
      console.error('Error fetching unread count:', err);
      setUnreadCount(0);
    }
  };

  const handleSendMessage = async () => {
    // First hide the form
    setShowComposeForm(false);
    
    // Manual refresh with setTimeout to avoid React render cycle issues
    setTimeout(() => {
      try {
        fetchMessages(activeTab);
      } catch (err) {
        console.error('Error refreshing messages:', err);
      }
    }, 0);
  };

  const handleMarkAsRead = async (messageId: number) => {
    try {
      // First update server
      await api.post(`/messages/${messageId}/mark_as_read/`);
      
      // Then update local message list state
      const updatedMessages = messages.map((msg: any) =>
        msg.id === messageId ? { ...msg, is_read: true } : msg
      );
      setMessages(updatedMessages);
      
      // Update unread count using direct value calculation instead of API call
      const unreadMessages = updatedMessages.filter((msg: any) => !msg.is_read);
      setUnreadCount(unreadMessages.length);
    } catch (err) {
      console.error('Error marking message as read:', err);
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