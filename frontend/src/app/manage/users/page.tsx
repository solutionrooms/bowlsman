'use client';

import { useState, useEffect } from 'react';
import { message } from 'antd';
import type { ChangeEvent } from 'react';
import api from '../../../lib/axios';

interface User {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
  first_name: string;
  last_name: string;
  display_name: string;
  search_name: string;
  is_active: boolean;
}

interface UserFormValues {
  username: string;
  email: string;
  is_staff: boolean;
  first_name: string;
  last_name: string;
  is_active: boolean;
}

export default function ManageUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [formValues, setFormValues] = useState<UserFormValues>({
    username: '',
    email: '',
    is_staff: false,
    first_name: '',
    last_name: '',
    is_active: true
  });

  const fetchUsers = async () => {
    try {
      const response = await api.get<User[]>('/users/');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      message.error('Failed to fetch users');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/users/${id}/`);
      message.success('User deactivated successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error deactivating user:', error);
      message.error('Failed to deactivate user');
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormValues({
      username: user.username,
      email: user.email,
      is_staff: user.is_staff,
      first_name: user.first_name,
      last_name: user.last_name,
      is_active: user.is_active
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}/`, formValues);
        message.success('User updated successfully');
      } else {
        const newUserData = {
          ...formValues,
          password: 'defaultpassword123'
        };
        await api.post('/users/', newUserData);
        message.success('User added successfully');
      }
      setIsModalOpen(false);
      setEditingUser(null);
      setFormValues({ username: '', email: '', is_staff: false, first_name: '', last_name: '', is_active: true });
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      const axiosError = error as any;
      message.error(axiosError?.response?.data?.error || 'Failed to save user');
    }
  };

  const handlePasswordReset = async () => {
    if (!selectedUserId || !newPassword) return;

    try {
      await api.post(`/users/${selectedUserId}/reset_password/`, { password: newPassword });
      message.success('Password reset successfully');
      setIsPasswordModalOpen(false);
      setNewPassword('');
      setSelectedUserId(null);
    } catch (error) {
      console.error('Error resetting password:', error);
      message.error('Failed to reset password');
    }
  };

  const openPasswordModal = (userId: number) => {
    setSelectedUserId(userId);
    setIsPasswordModalOpen(true);
  };

  const filteredUsers = searchTerm
    ? users.filter(user => user.search_name.includes(searchTerm.toLowerCase()))
    : users;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">Manage Users</h1>
              <button
                onClick={() => {
                  setEditingUser(null);
                  setFormValues({ username: '', email: '', is_staff: false, first_name: '', last_name: '', is_active: true });
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Add User
              </button>
            </div>

            <div className="mb-4">
              <input
                type="search"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                autoComplete="off"
                data-lpignore="true"
              />
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">First Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className={!user.is_active ? 'bg-gray-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.username}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.first_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.last_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={user.is_staff ? 'text-green-600' : 'text-gray-500'}>
                          {user.is_staff ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={user.is_active ? 'text-green-600' : 'text-red-600'}>
                          {user.is_active ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-3">
                          <button
                            onClick={() => handleEdit(user)}
                            className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-md hover:bg-indigo-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => openPasswordModal(user.id)}
                            className="bg-blue-100 text-blue-700 px-3 py-1 rounded-md hover:bg-blue-200"
                          >
                            Reset Password
                          </button>
                          {user.is_active && (
                            <button
                              onClick={() => handleDelete(user.id)}
                              className="bg-red-100 text-red-700 px-3 py-1 rounded-md hover:bg-red-200"
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isModalOpen && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
                <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                  <div className="mt-3">
                    <h3 className="text-lg font-medium leading-6 text-gray-900">
                      {editingUser ? 'Edit User' : 'Add User'}
                    </h3>
                    <div className="mt-2 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">First Name</label>
                        <input
                          type="text"
                          value={formValues.first_name}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setFormValues({ ...formValues, first_name: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Last Name</label>
                        <input
                          type="text"
                          value={formValues.last_name}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setFormValues({ ...formValues, last_name: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Username</label>
                        <input
                          type="text"
                          value={formValues.username}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setFormValues({ ...formValues, username: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                          type="email"
                          value={formValues.email}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setFormValues({ ...formValues, email: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                      </div>

                      <div className="flex items-center space-x-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Staff</label>
                          <input
                            type="checkbox"
                            checked={formValues.is_staff}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setFormValues({ ...formValues, is_staff: e.target.checked })}
                            className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Active</label>
                          <input
                            type="checkbox"
                            checked={formValues.is_active}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setFormValues({ ...formValues, is_active: e.target.checked })}
                            className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setIsModalOpen(false);
                        setEditingUser(null);
                        setFormValues({ username: '', email: '', is_staff: false, first_name: '', last_name: '', is_active: true });
                      }}
                      className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      {editingUser ? 'Save Changes' : 'Add User'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isPasswordModalOpen && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
                <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                  <div className="mt-3">
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Reset Password</h3>
                    <div className="mt-2">
                      <input
                        type="password"
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setIsPasswordModalOpen(false);
                        setNewPassword('');
                        setSelectedUserId(null);
                      }}
                      className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePasswordReset}
                      className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Reset Password
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 