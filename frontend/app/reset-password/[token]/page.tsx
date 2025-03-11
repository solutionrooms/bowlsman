'use client';

import React, { useState, FormEvent, ChangeEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '../../../src/lib/axios';
import { validatePassword, getPasswordRules } from '../../../src/lib/passwordValidation';

export default function ResetPasswordConfirm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    // Validate password using our utility function
    const validation = validatePassword(password);
    if (!validation.isValid) {
      setMessage(validation.message);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.post('/users/confirm_password_reset/', {
        token,
        password
      });

      setIsSuccess(true);
      setMessage('Your password has been reset successfully.');
    } catch (error: any) {
      console.error('Error:', error);
      setMessage(error.response?.data?.error || 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>, setter: (value: string) => void) => {
    setter(e.target.value);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">Reset Your Password</h1>
        {message && (
          <p className={`mb-4 ${isSuccess ? 'text-green-500' : 'text-red-500'}`}>
            {message}
          </p>
        )}
        {!isSuccess ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => handleInputChange(e, setPassword)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                {getPasswordRules()}
              </p>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => handleInputChange(e, setConfirmPassword)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 transition disabled:bg-blue-300"
            >
              {isSubmitting ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        ) : (
          <div className="text-center">
            <p className="mb-4">
              Your password has been reset successfully.
            </p>
            <button
              onClick={() => router.push('/')}
              className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              Return to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 