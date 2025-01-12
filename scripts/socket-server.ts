import { Server as SocketIOServer } from 'socket.io';
import express from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import db from '@/lib/db';
import { calculateEffectiveStatus } from '@/lib/status';

// Load environment variables from .env.local if it exists
dotenv.config({ path: '.env.local' });

interface StatusChanged {
  userId: string;
  deviceId: string;
  autoStatus: 'online' | 'away' | 'dnd' | 'offline';
  manualStatus?: 'online' | 'away' | 'dnd' | 'offline' | null;
}

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const statusDebounceMap = new Map<string, NodeJS.Timeout>();
let isRunning = false;

// Express middleware
app.use(express.json());

// Simplified middleware to just verify userId exists
io.use(async (socket, next) => {
  try {
    const userId = socket.handshake.auth.userId;
    
    if (!userId) {
      return next(new Error('No userId provided'));
    }

    const { rows } = await db.query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (rows.length === 0) {
      return next(new Error('User not found'));
    }

    socket.data.userId = userId;
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
});

async function updateUserDeviceStatus(
  userId: string,
  deviceId: string,
  status: 'online' | 'away' | 'dnd' | 'offline',
  manualStatus: string | null | undefined,
  userAgent: string
) {
  const { rows: [updatedStatus] } = await db.query(`
    WITH device_info AS (
      SELECT jsonb_build_object(
        'id', $3::text,
        'status', $1::text,
        'userAgent', $4::text,
        'last_active', CURRENT_TIMESTAMP
      ) as new_device
    ),
    updated_devices AS (
      SELECT 
        CASE
          WHEN us.devices @> jsonb_build_array(jsonb_build_object('id', $3))::jsonb THEN
            (
              SELECT jsonb_agg(
                CASE 
                  WHEN d->>'id' = $3::text THEN 
                    (SELECT new_device FROM device_info)
                  ELSE d 
                END
              )
              FROM jsonb_array_elements(us.devices) d
            )
          ELSE
            COALESCE(us.devices, '[]'::jsonb) || 
            jsonb_build_array((SELECT new_device FROM device_info))
        END as devices
      FROM user_status us
      WHERE user_id = $5
    )
    INSERT INTO user_status (user_id, auto_status, manual_status, devices)
    VALUES ($5, $1::text, $2::text, (
      SELECT jsonb_build_array((SELECT new_device FROM device_info))
    ))
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      auto_status = $1::text,
      manual_status = $2::text,
      devices = (SELECT devices FROM updated_devices),
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `, [
    status,
    manualStatus,
    deviceId,
    userAgent,
    userId
  ]);

  return updatedStatus;
}

io.on('connection', async (socket) => {
  const userId = socket.data.userId;
  console.log(`User connected - Socket: ${socket.id}, User: ${userId}`);

  try {
  
    socket.on('statusChanged', async (update: StatusChanged) => {
      // Verify the user can only update their own status
      if (update.userId !== socket.data.userId) {
        console.error('Unauthorized status update attempt');
        return;
      }
      console.log('Received statusChanged event');
      console.log('Status changed:', update);
      const { userId, deviceId, autoStatus, manualStatus } = update;

      // Debounce status updates per user
      if (statusDebounceMap.has(userId)) {
        clearTimeout(statusDebounceMap.get(userId));
      }

      statusDebounceMap.set(userId, setTimeout(async () => {
        try {
          const updatedStatus = await updateUserDeviceStatus(
            userId,
            deviceId,
            autoStatus,
            manualStatus,
            socket.handshake.headers['user-agent'] || ''
          );
          
          const effectiveStatus = calculateEffectiveStatus(updatedStatus);
          console.log('Updated status:', updatedStatus);
          io.emit('statusChanged', effectiveStatus);
        } catch (error) {
          console.error('Error updating status:', error);
        }
      }, 1000));
    });

    socket.on('disconnect', async (reason) => {
      console.log(`User ${userId} disconnected: ${reason}`);
      
      // Clear any pending status update timeouts
      const timeout = statusDebounceMap.get(userId);
      if (timeout) {
        clearTimeout(timeout);
        statusDebounceMap.delete(userId);
      }

      // Update the user's status in the database
      const { rows: [result] } = await db.query(`
        UPDATE user_status 
        SET auto_status = 'offline',
            last_seen = CURRENT_TIMESTAMP
        WHERE user_id = $1
        RETURNING *
      `, [userId]);

      if (result) {
        console.log('Result:', result);
        const effectiveStatus = calculateEffectiveStatus(result);
        io.emit('statusChanged', effectiveStatus);
      }
    });
    // Initialize or update user status
    try {
      const userStatus = await updateUserDeviceStatus(
        userId,
        socket.id,
        'online',
        undefined,
        socket.handshake.headers['user-agent'] || ''
      );

      const effectiveStatus = calculateEffectiveStatus(userStatus);
      io.emit('statusChanged', effectiveStatus);
    } catch (error) {
      console.error('Error handling socket connection:', error);
      socket.disconnect();
    }
  } catch (error) {
    console.error('Error handling socket connection:', error);
    socket.disconnect();
  }
});

function start() {
  if (isRunning) {
    return; // Prevent multiple starts
  }

  const PORT = parseInt(process.env.SOCKET_PORT || '3001', 10);
  
  // Add error handling for the server
  httpServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.log('Port is already in use, retrying in 1 second...');
      setTimeout(() => {
        httpServer.close();
        httpServer.listen(PORT);
      }, 1000);
    }
  });

  httpServer.listen(PORT, () => {
    isRunning = true;
    console.log(`Socket.IO server running on port ${PORT}`);
  });
}

// Only start the server if we're not in a Next.js API route
const isNextApiRoute = process.env.NEXT_RUNTIME === 'edge' || process.env.NEXT_RUNTIME === 'nodejs';

if (!isNextApiRoute) {
  start();
} else {
  console.log('Socket.IO server is running in Next.js API route, you should not see this message');
}

// Export the IO instance for external use
export { io }; 