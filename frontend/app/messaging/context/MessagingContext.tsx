'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../../../src/lib/axios';

interface MessagingContextType {
  unreadCount: number;
  fetchUnreadCount: () => Promise<void>;
}

interface UnreadMessage {
  id: number;
  // Add other message properties as needed
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

export function MessagingProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentClub, setCurrentClub] = useState<number | null>(null);

  useEffect(() => {
    // Get current club from localStorage
    if (typeof window !== 'undefined') {
      const storedClub = localStorage.getItem('currentClub');
      if (storedClub) {
        try {
          const club = JSON.parse(storedClub);
          setCurrentClub(club.id);
        } catch (e) {
          // Handle potential JSON parse error
          console.error('Error parsing current club:', e);
        }
      }
    }

    // Listen for club change events
    const handleClubChange = (event: CustomEvent) => {
      if (event.detail?.club?.id) {
        setCurrentClub(event.detail.club.id);
      }
    };

    window.addEventListener('clubChanged', handleClubChange as EventListener);

    // Initial fetch
    fetchUnreadCount();

    // Set up polling for unread messages (every 60 seconds)
    const interval = setInterval(fetchUnreadCount, 60000);

    return () => {
      window.removeEventListener('clubChanged', handleClubChange as EventListener);
      clearInterval(interval);
    };
  }, []);

  // Fetch unread count whenever current club changes
  useEffect(() => {
    if (currentClub) {
      fetchUnreadCount();
    }
  }, [currentClub]);

  const fetchUnreadCount = async () => {
    // Exit early if we're server-side rendering or no club is selected
    if (typeof window === 'undefined' || !currentClub) return;
    
    try {
      console.log('Fetching unread message count for club:', currentClub);
      const response = await api.get<UnreadMessage[]>('messages/unread', {
        params: { club_id: currentClub }
      });
      
      console.log('Unread messages:', response.data.length);
      setUnreadCount(response.data.length);
    } catch (err) {
      console.error('Error fetching unread count:', err);
      setUnreadCount(0);
    }
  };

  return (
    <MessagingContext.Provider value={{ unreadCount, fetchUnreadCount }}>
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  const context = useContext(MessagingContext);
  if (context === undefined) {
    throw new Error('useMessaging must be used within a MessagingProvider');
  }
  return context;
} 