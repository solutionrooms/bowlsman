'use client';

import { ReactNode } from 'react';
import Navigation from '../components/Navigation';

interface HelpLayoutProps {
  children: ReactNode;
}

export default function HelpLayout({ children }: HelpLayoutProps) {
  const handleLogout = () => {
    // This is just a placeholder - the actual logout logic is in the Navigation component
    console.log('Logout from help layout');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation onLogout={handleLogout} />
      <main className="pt-16">
        {children}
      </main>
    </div>
  );
} 