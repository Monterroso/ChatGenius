/**
 * SearchResultsPopup Component
 * 
 * A modal overlay component that displays search results from message searches.
 * Features:
 * - Displays message content with sender information
 * - Shows timestamps
 * - Handles both direct and group messages
 * - Scrollable content
 * - Close button
 * - Click outside to close
 * - Loading state
 */

import { useRef, useEffect } from 'react';
import { X, User } from 'lucide-react';
import type { SearchResult } from '@/types/db';

interface SearchResultsPopupProps {
  /** Array of messages that match the search criteria */
  results: SearchResult[];
  /** Whether the search is currently in progress */
  isLoading?: boolean;
  /** Callback function to close the popup */
  onClose: () => void;
  /** Optional callback when a message is clicked */
  onMessageClick?: (message: SearchResult) => void;
}

export default function SearchResultsPopup({
  results,
  isLoading = false,
  onClose,
  onMessageClick
}: SearchResultsPopupProps) {
  // Reference to the popup content for click outside handling
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div 
        ref={contentRef}
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        role="dialog"
        aria-labelledby="search-results-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="search-results-title" className="text-xl font-semibold">
            Search Results
            <span className="ml-2 text-sm text-gray-500">
              {results.length} {results.length === 1 ? 'message' : 'messages'} found
            </span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close search results"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div 
                className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"
                role="status"
                aria-label="Loading search results"
              />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No messages found matching your search criteria
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((message) => (
                <div
                  key={message.id}
                  onClick={() => onMessageClick?.(message)}
                  className={`p-4 rounded-lg border ${
                    onMessageClick ? 'cursor-pointer hover:bg-gray-50' : ''
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onMessageClick?.(message);
                    }
                  }}
                >
                  {/* Message header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-500" aria-hidden="true" />
                      </div>
                      <span className="font-medium">
                        {message.sender?.name || message.sender?.username || 'Unknown User'}
                      </span>
                      {message.group_id && (
                        <span className="text-sm text-gray-500">
                          in group chat
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(message.created_at).toLocaleString()}
                    </span>
                  </div>

                  {/* Message content */}
                  <div className="text-gray-700">
                    {message.content.startsWith('FILE:') ? (
                      <div className="flex items-center gap-2 text-primary">
                        <span className="text-sm" aria-label="File attachment">📎 File attachment</span>
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 