import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import dotenv from 'dotenv';
import db from '@/lib/db';
import { calculateEffectiveStatus } from '@/lib/status';

// Load environment variables from .env.local if it exists
dotenv.config({ path: '.env.local' });

interface StatusUpdate {
  userId: string;
  deviceId: string;
  autoStatus: 'online' | 'away' | 'dnd' | 'offline';
}

class SocketServer {
  private static instance: SocketServer;
  private io: SocketIOServer;
  private httpServer;
  private statusDebounceMap = new Map<string, NodeJS.Timeout>();
  private isRunning = false;

  private constructor() {
    this.httpServer = createServer();
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.setupEventHandlers();
  }

  public static getInstance(): SocketServer {
    if (!SocketServer.instance) {
      SocketServer.instance = new SocketServer();
    }
    return SocketServer.instance;
  }

  private setupEventHandlers() {
    this.io.on('connection', async (socket) => {
      const userId = socket.handshake.auth.userId;
      console.log(`User connected - Socket: ${socket.id}, User: ${userId}`);

      if (!userId) {
        console.log('No user ID provided, closing connection');
        socket.disconnect();
        return;
      }

      // Verify user exists
      const { rows } = await db.query(
        'SELECT id FROM users WHERE id = $1',
        [userId]
      );

      if (rows.length === 0) {
        console.error(`User ${userId} not found in users table`);
        socket.disconnect();
        return;
      }

      socket.on('statusUpdate', async (update: StatusUpdate) => {
        const { userId, deviceId, autoStatus } = update;

        // Debounce status updates per user
        if (this.statusDebounceMap.has(userId)) {
          clearTimeout(this.statusDebounceMap.get(userId));
        }

        this.statusDebounceMap.set(userId, setTimeout(async () => {
          const { rows: [result] } = await db.query(`
            UPDATE user_status 
            SET 
              auto_status = $2,
              last_seen = CURRENT_TIMESTAMP,
              devices = COALESCE(
                jsonb_set(
                  devices,
                  CASE 
                    WHEN jsonb_exists(devices, $3) THEN format('[%s]', (
                      SELECT position - 1 
                      FROM jsonb_array_elements(devices) WITH ORDINALITY AS arr(obj, position) 
                      WHERE obj->>'id' = $3
                    )::text)
                    ELSE '[-1]'
                  END,
                  jsonb_build_object(
                    'id', $3,
                    'lastActive', to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                    'userAgent', $4
                  )::jsonb,
                  true
                ),
                '[]'::jsonb
              )
            WHERE user_id = $1
            RETURNING *
          `, [userId, autoStatus, deviceId, socket.handshake.headers['user-agent'] || '']);

          if (result) {
            const effectiveStatus = calculateEffectiveStatus(result);
            this.io.emit('statusChanged', effectiveStatus);
          }
        }, 1000));
      });

      socket.on('disconnect', (reason) => {
        console.log(`User ${userId} disconnected: ${reason}`);
      });
    });
  }

  public start() {
    if (this.isRunning) {
      return; // Prevent multiple starts
    }

    const PORT = parseInt(process.env.SOCKET_PORT || '3001', 10);
    
    // Add error handling for the server
    this.httpServer.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.log('Port is already in use, retrying in 1 second...');
        setTimeout(() => {
          this.httpServer.close();
          this.httpServer.listen(PORT);
        }, 1000);
      }
    });

    this.httpServer.listen(PORT, () => {
      this.isRunning = true;
      console.log(`Socket.IO server running on port ${PORT}`);
    });
  }

  public getIO() {
    return this.io;
  }
}

// Only start the server if we're not in a Next.js API route
const isNextApiRoute = process.env.NEXT_RUNTIME === 'edge' || process.env.NEXT_RUNTIME === 'nodejs';
const socketServer = SocketServer.getInstance();

if (!isNextApiRoute) {
  socketServer.start();
}

// Export the singleton instance's IO for external use
export const io = socketServer.getIO(); 