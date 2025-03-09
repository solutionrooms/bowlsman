'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '../../src/lib/axios';
import Navigation from '../components/Navigation';
import { useMessaging } from './context/MessagingContext';
import ChatList from './components/ChatList';
import ChatDetail from './components/ChatDetail';
import CreateChatModal from './components/CreateChatModal';

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

export default function MessagingPage() {
  const [selectedClub, setSelectedClub] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  
  const { fetchChats, fetchUnreadCount } = useMessaging();

  // Memoize these functions to prevent them from being recreated on every render
  const handleSelectChat = useCallback((chatId: number) => {
    setSelectedChatId(chatId);
  }, []);

  const handleCreateChat = useCallback((chatId: number) => {
    setSelectedChatId(chatId);
  }, []);

  // Load the current club from localStorage only once on component mount
  useEffect(() => {
    // Get current club from localStorage
    if (typeof window !== 'undefined') {
      const storedClub = localStorage.getItem('currentClub');
      if (storedClub) {
        try {
          const club = JSON.parse(storedClub);
          setSelectedClub(club.id);
        } catch (e) {
          console.error('Error parsing current club:', e);
        }
      }
    }

    // Listen for club change events
    const handleClubChange = (event: CustomEvent) => {
      if (event.detail?.club?.id) {
        setSelectedClub(event.detail.club.id);
        setSelectedChatId(null); // Reset selected chat when club changes
      }
    };

    window.addEventListener('clubChanged', handleClubChange as EventListener);

    return () => {
      window.removeEventListener('clubChanged', handleClubChange as EventListener);
    };
  }, []); // Empty dependency array means this effect runs only once on mount

  // Memoize the data fetching function to prevent it from being recreated on every render
  const fetchData = useCallback(async (clubId: number) => {
    if (!clubId) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Fetch chats for the selected club
      await fetchChats(clubId);
      // Fetch unread count
      await fetchUnreadCount(clubId);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load chats. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [fetchChats, fetchUnreadCount]);

  // Only fetch data when the selected club changes
  useEffect(() => {
    if (selectedClub) {
      fetchData(selectedClub);
    }
  }, [selectedClub, fetchData]); // Only re-run when selectedClub or fetchData changes

  if (!selectedClub) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navigation onLogout={() => {}} />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
              <p className="text-gray-500">Please select a club to view messages</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation onLogout={() => {}} />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="border-b border-gray-200 p-4 flex justify-between items-center">
              <h1 className="text-2xl font-semibold text-gray-900">Chat</h1>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                New Chat
              </button>
            </div>
            
            {loading ? (
              <div className="flex justify-center items-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : error ? (
              <div className="p-4 text-center text-red-500">
                {error}
              </div>
            ) : (
              <div className="flex h-[calc(100vh-220px)]">
                <div className="w-1/3 border-r border-gray-200">
                  <ChatList 
                    onSelectChat={handleSelectChat} 
                    selectedChatId={selectedChatId} 
                  />
                </div>
                <div className="w-2/3">
                  <ChatDetail chatId={selectedChatId} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {showCreateModal && (
        <CreateChatModal 
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          clubId={selectedClub}
          onChatCreated={handleCreateChat}
        />
      )}
    </div>
  );
}