/**
 * GroupCreationDialog Component
 * 
 * A modal dialog component for creating new chat groups.
 * Features:
 * - Input field for group name
 * - Create button with loading state
 * - Error handling and display
 * - Cancel button
 * - Click outside to close
 */

import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import type { DBGroup } from '@/types/db';

interface GroupCreationDialogProps {
  /** Whether the dialog is currently open */
  isOpen: boolean;
  /** Callback function to close the dialog */
  onClose: () => void;
  /** Callback function called when a group is successfully created */
  onGroupCreated: (group: DBGroup) => void;
}

export function GroupCreationDialog({ isOpen, onClose, onGroupCreated }: GroupCreationDialogProps) {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim()
        }),
      });

      if (response.ok) {
        const group: DBGroup = await response.json();
        onGroupCreated(group);
        onClose();
        setName('');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create group');
      }
    } catch (err) {
      setError('Failed to create group');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-md rounded bg-white p-6">
          <Dialog.Title className="text-lg font-medium text-gray-900">
            Create New Group
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Group Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
                placeholder="Enter group name..."
              />
            </div>

            {error && (
              <div className="text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={isLoading}
              >
                {isLoading ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
} 