import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { CogIcon, SaveIcon, TrashIcon } from '@heroicons/react/outline';

interface Bot {
  id: string;
  name: string;
  personality?: string;
  api_key?: string;
}

interface BotConfigProps {
  bot: Bot;
  onUpdate: (bot: Bot) => Promise<void>;
  onDelete: (botId: string) => Promise<void>;
}

export function BotConfig({ bot, onUpdate, onDelete }: BotConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(bot.name);
  const [personality, setPersonality] = useState(bot.personality || '');
  const [apiKey, setApiKey] = useState(bot.api_key || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(bot.name);
    setPersonality(bot.personality || '');
    setApiKey(bot.api_key || '');
  }, [bot]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await onUpdate({
        ...bot,
        name,
        personality,
        api_key: apiKey,
      });
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update bot');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this bot?')) {
      setIsLoading(true);
      try {
        await onDelete(bot.id);
        setIsOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete bot');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
      >
        <CogIcon className="w-5 h-5" />
      </button>

      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-md rounded bg-white p-6">
            <Dialog.Title className="text-lg font-medium">
              Bot Configuration
            </Dialog.Title>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Personality
                </label>
                <textarea
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Describe the bot's personality..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  API Key (Optional)
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {error && (
                <div className="text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center px-3 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  disabled={isLoading}
                >
                  <TrashIcon className="w-4 h-4 mr-2" />
                  Delete Bot
                </button>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    disabled={isLoading}
                  >
                    <SaveIcon className="w-4 h-4 mr-2" />
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}