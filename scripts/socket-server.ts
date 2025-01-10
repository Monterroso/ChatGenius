import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import dotenv from 'dotenv';
import db from '@/lib/db';

// Load environment variables from .env.local if it exists
dotenv.config({ path: '.env.local' });

const httpServer = createServer();
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Track user presences
const userPresences: Record<string, string> = {};

// Log connected users every minute
setInterval(() => {
  const connectedSockets = Array.from(io.sockets.sockets.values());
  console.log(`Connected users: ${connectedSockets.length}`);
  console.log('Current presences:', userPresences);
}, 60000);

io.on('connection', async (socket) => {
  const userId = socket.handshake.auth.userId;
  console.log(`User connected - Socket: ${socket.id}, User: ${userId}`);

  if (userId) {
    try {
      // First, verify the user exists
      const userExists = await db.query(
        'SELECT id FROM users WHERE id = $1',
        [userId]
      );

      if (userExists.rows.length === 0) {
        console.error(`User ${userId} not found in users table`);
        return;
      }

      // Then update or create presence
      await db.query(
        'INSERT INTO user_presence (user_id, presence, last_seen) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (user_id) DO UPDATE SET presence = $2, last_seen = CURRENT_TIMESTAMP',
        [userId, 'online']
      );
      
      userPresences[userId] = 'online';
      io.emit('userPresenceChanged', { userId, presence: 'online' });
    } catch (error) {
      console.error('Error updating user presence:', error);
    }
  }

  socket.on('presenceChange', async (presence) => {
    if (userId) {
      // Update database when presence changes
      await db.query(
        'UPDATE user_presence SET presence = $1, last_seen = CURRENT_TIMESTAMP WHERE user_id = $2',
        [presence, userId]
      );

      userPresences[userId] = presence;
      io.emit('userPresenceChanged', { userId, presence });
      console.log(`User ${userId} presence: ${presence}`);
    }
  });

  socket.on('disconnect', async (reason) => {
    if (userId) {
      // Update database when user disconnects
      await db.query(
        'UPDATE user_presence SET presence = $1, last_seen = CURRENT_TIMESTAMP WHERE user_id = $2',
        ['offline', userId]
      );

      userPresences[userId] = 'offline';
      io.emit('userPresenceChanged', { userId, presence: 'offline' });
      console.log(`User ${userId} disconnected: ${reason}`);
    }
  });

  // Load initial presences from database instead of memory
  const result = await db.query(
    'SELECT user_id, presence FROM user_presence WHERE presence != $1',
    ['invisible']
  );
  const dbPresences = result.rows.reduce((acc, row) => {
    acc[row.user_id] = row.presence;
    return acc;
  }, {} as Record<string, string>);
  
  // Merge with in-memory presences (in-memory takes precedence)
  socket.emit('initialPresences', { ...dbPresences, ...userPresences });
});

const PORT = parseInt(process.env.SOCKET_PORT || '3001', 10);
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
}); 