'use client';

import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';

// Add JSX namespace to fix HTML element type errors
declare namespace JSX {
  interface IntrinsicElements {
    ul: React.DetailedHTMLProps<React.HTMLAttributes<HTMLUListElement>, HTMLUListElement>;
    li: React.DetailedHTMLProps<React.LIAttributes<HTMLLIElement>, HTMLLIElement>;
    h2: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
    br: React.DetailedHTMLProps<React.HTMLAttributes<HTMLBRElement>, HTMLBRElement>;
  }
}

export default function PrivacyPolicy() {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentClub');
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation onLogout={handleLogout} />
      
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white shadow rounded-lg p-6">
            <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
            
            <div className="prose max-w-none">
              <p className="mb-4">
                We take your privacy seriously. To manage your membership and ensure smooth operation of the bowling club app, we collect the following information:
              </p>
              
              <ul className="list-disc pl-5 mb-4">
                <li>Email Address</li>
                <li>Postcode</li>
                <li>Telephone Number</li>
              </ul>
              
              <h2 className="text-xl font-semibold mt-6 mb-3">How Your Information is Used:</h2>
              <p className="mb-4">
                Your personal details will be securely stored and are used solely for club administration and communications.
              </p>
              <p className="mb-4">
                Your information will never be shared publicly or displayed to other users within the app.
              </p>
              
              <h2 className="text-xl font-semibold mt-6 mb-3">Data Security:</h2>
              <p className="mb-4">
                We implement strict security measures to ensure your personal information remains protected.
              </p>
              
              <h2 className="text-xl font-semibold mt-6 mb-3">Your Rights:</h2>
              <p className="mb-4">
                Under GDPR, you have the right to request access, correction, or deletion of your personal data at any time by contacting us directly.
              </p>
              
              <p className="mb-4">
                By registering, you consent to your information being processed as described.
              </p>
              
              <h2 className="text-xl font-semibold mt-6 mb-3">Contact Information:</h2>
              <p className="mb-4">
                For questions or requests, please contact:<br />
                The Secretary<br />
                Westlands Bowling Club
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 