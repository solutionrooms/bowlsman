'use client';

import React, { useState, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../src/lib/axios';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await api.post('/users/request_password_reset/', {
        email
      });

      setIsSuccess(true);
      setMessage('If an account with this email exists, a password reset link has been sent.');
    } catch (error: any) {
      console.error('Error:', error);
      setMessage(error.response?.data?.error || 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
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
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 transition disabled:bg-blue-300"
            >
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <div className="text-center">
            <p className="mb-4">
              Please check your email for the password reset link. The link will expire in 24 hours.
            </p>
            <button
              onClick={() => router.push('/')}
              className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              Return to Login
            </button>
          </div>
        )}
        <div className="mt-4 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-blue-500 hover:underline"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
} 