import React, { useState } from 'react';
import { ThumbUpIcon, ThumbDownIcon, InformationCircleIcon } from '@heroicons/react/outline';
import { Transition } from '@headlessui/react';

interface Source {
  pageContent: string;
  metadata: Record<string, any>;
}

interface BotMessageProps {
  content: string;
  timestamp: Date;
  sourceDocuments?: Source[];
  onFeedback?: (rating: number, feedbackText?: string) => void;
  isLoading?: boolean;
}

export function BotMessage({
  content,
  timestamp,
  sourceDocuments,
  onFeedback,
  isLoading = false,
}: BotMessageProps) {
  const [showSources, setShowSources] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

  const handleFeedback = async (rating: number) => {
    if (feedbackGiven) return;
    setFeedbackGiven(true);
    setShowFeedbackInput(rating < 4); // Show feedback input for low ratings
    onFeedback?.(rating);
  };

  const submitDetailedFeedback = () => {
    if (feedbackText.trim()) {
      onFeedback?.(1, feedbackText);
      setShowFeedbackInput(false);
      setFeedbackText('');
    }
  };

  return (
    <div className="flex flex-col space-y-2 animate-fadeIn">
      <Transition
        show={!isLoading}
        enter="transition-opacity duration-200"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-150"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="flex items-start space-x-2">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-white font-bold">AI</span>
            </div>
          </div>
          <div className="flex-grow">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="prose max-w-none">
                {content}
              </div>
              {sourceDocuments && sourceDocuments.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowSources(!showSources)}
                    className="flex items-center text-sm text-gray-500 hover:text-gray-700"
                  >
                    <InformationCircleIcon className="w-4 h-4 mr-1" />
                    {showSources ? 'Hide Sources' : 'Show Sources'}
                  </button>
                  {showSources && (
                    <div className="mt-2 space-y-2">
                      {sourceDocuments.map((source, index) => (
                        <div key={index} className="text-sm bg-gray-50 p-2 rounded">
                          <div className="font-medium text-gray-700">Source {index + 1}</div>
                          <div className="text-gray-600">{source.pageContent}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {onFeedback && !feedbackGiven && (
                <div className="mt-2 flex items-center space-x-2">
                  <button
                    onClick={() => handleFeedback(5)}
                    className="text-gray-400 hover:text-green-500 transition-colors"
                  >
                    <ThumbUpIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleFeedback(1)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <ThumbDownIcon className="w-5 h-5" />
                  </button>
                </div>
              )}
              {showFeedbackInput && (
                <div className="mt-2">
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="What could be improved?"
                    className="w-full p-2 border rounded-md text-sm"
                    rows={3}
                  />
                  <button
                    onClick={submitDetailedFeedback}
                    className="mt-1 px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
                  >
                    Submit Feedback
                  </button>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {new Date(timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      </Transition>
      {isLoading && (
        <div className="flex items-center space-x-2 text-gray-400">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      )}
    </div>
  );
} 