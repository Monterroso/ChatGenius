'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface User {
  id: string;
  name: string;
  username: string;
}

interface Message {
  id: string;
  content: string;
  userId: string;
  createdAt: string;
}

export default function Chat() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchUsers();
      fetchMessages();
    }
  }, [session]);

  const fetchUsers = async () => {
    const response = await fetch('/api/users');
    if (response.ok) {
      const data = await response.json();
      setUsers(data);
    }
  };

  const fetchMessages = async () => {
    const response = await fetch('/api/messages');
    if (response.ok) {
      const data = await response.json();
      setMessages(data);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: message }),
      });

      if (response.ok) {
        setMessage('');
        fetchMessages();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex h-screen">
      <div className="w-1/4 bg-gray-800 text-white p-4 flex flex-col">
        {/* Channels Section */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Channels</h2>
          <ul>
            <li className="mb-2 hover:bg-gray-700 p-2 rounded cursor-pointer"># general</li>
            <li className="mb-2 hover:bg-gray-700 p-2 rounded cursor-pointer"># random</li>
            {/* Add more channels as needed */}
          </ul>
        </div>

        {/* Users Section */}
        <div>
          <h2 className="text-xl font-bold mb-4">Users</h2>
          <ul>
            {users.map((user) => (
              <li key={user.id} className="mb-2 hover:bg-gray-700 p-2 rounded cursor-pointer">
                {user.name} (@{user.username})
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="w-3/4 flex flex-col">
        <div className="flex-grow p-4 overflow-y-auto">
          <div className="space-y-4">
            {messages.map((msg) => {
              const user = users.find((u) => u.id === msg.userId);
              const isCurrentUser = msg.userId === session?.user?.id;
              
              return (
                <div 
                  key={msg.id}
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] rounded-lg p-3 ${
                    isCurrentUser ? 'bg-primary text-primary-foreground' : 'bg-gray-100'
                  }`}>
                    <div className="text-sm font-semibold mb-1">
                      {user?.name || 'Unknown User'}
                    </div>
                    <div className="break-words">
                      {msg.content}
                    </div>
                    <div className="text-xs mt-1 opacity-70">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Type a message..."
              className="w-full px-3 py-2 border rounded-md"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <button 
              onClick={handleSendMessage}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

