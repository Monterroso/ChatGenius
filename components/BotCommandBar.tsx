import React, { useState, useEffect, useRef } from 'react';
import { CommandIcon } from '@heroicons/react/outline';

interface Command {
  command: string;
  description: string;
}

interface BotCommandBarProps {
  botId: string;
  onSelectCommand: (command: string) => void;
  inputValue: string;
}

export function BotCommandBar({ botId, onSelectCommand, inputValue }: BotCommandBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [commands, setCommands] = useState<Command[]>([]);
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch available commands for the bot
    const fetchCommands = async () => {
      try {
        const response = await fetch(`/api/bots/commands?botId=${botId}`);
        if (response.ok) {
          const data = await response.json();
          setCommands(data);
        }
      } catch (error) {
        console.error('Error fetching commands:', error);
      }
    };

    fetchCommands();
  }, [botId]);

  useEffect(() => {
    // Show command bar when user types '/'
    if (inputValue === '/') {
      setIsOpen(true);
      setFilteredCommands(commands);
      setSelectedIndex(0);
    } else if (inputValue.startsWith('/')) {
      const query = inputValue.slice(1).toLowerCase();
      const filtered = commands.filter(
        cmd => cmd.command.toLowerCase().includes(query) ||
              cmd.description.toLowerCase().includes(query)
      );
      setFilteredCommands(filtered);
      setIsOpen(filtered.length > 0);
      setSelectedIndex(0);
    } else {
      setIsOpen(false);
    }
  }, [inputValue, commands]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % filteredCommands.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          onSelectCommand(filteredCommands[selectedIndex].command);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  useEffect(() => {
    // Scroll selected item into view
    const selectedElement = containerRef.current?.children[selectedIndex] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
      <div className="p-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center text-sm text-gray-500">
          <CommandIcon className="w-4 h-4 mr-2" />
          Available Commands
        </div>
      </div>
      <div ref={containerRef} className="py-1">
        {filteredCommands.map((cmd, index) => (
          <button
            key={cmd.command}
            className={`w-full text-left px-4 py-2 text-sm ${
              index === selectedIndex
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => {
              onSelectCommand(cmd.command);
              setIsOpen(false);
            }}
          >
            <div className="font-medium">{cmd.command}</div>
            <div className="text-xs text-gray-500">{cmd.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
} 