# Chat Page Documentation

## Overview
The chat page is a messaging interface that combines WebSocket connections for live status updates with REST API calls for message and group management.

## Layout Structure
The page is divided into three main sections:
- Left Sidebar (16px width): Contains logout button
- Navigation Panel (25% width): Lists groups and contacts
- Chat Area (75% width): Displays messages and input field

## Key Features

### Status Management
- Status updates via WebSocket connections
- Database stores persistent status in `user_status` table
- Status changes flow:
  1. Client connects/disconnects → WebSocket event → Database update → Broadcast to all clients
  2. Manual status changes → API call → Database update → WebSocket broadcast
- Supported statuses: online, offline, away, dnd (do not disturb), invisible
- Status indicators use color coding:
  - Green: Online
  - Gray: Offline
  - Yellow: Away
  - Red: Do Not Disturb
  - Light Gray: Invisible

### Groups
- Group operations use REST API calls to database
- Create groups: POST to `/api/groups`
- Fetch groups: GET from `/api/groups/member`
- Member management: Database queries via `/api/groups/${id}/members`
- Invite system:
  - Generate: POST to `/api/groups/${id}/invites`
  - Accept: POST to `/api/invites/${id}/accept`
  - No WebSocket implementation for group updates (requires page refresh)

### Direct Messages
- Message sending: REST API calls to `/api/messages`
- Message fetching: Database queries via `/api/messages?userId=${id}`
- Recent contacts: Database query to `/api/messages/contacts`
- User search: Database query to `/api/users`
- No WebSocket implementation for message delivery (requires manual refresh or polling)

## Data Flow

### Status Updates
1. Client connects to WebSocket server
2. Server queries database for initial status of all users
3. Status changes:
   - WebSocket events trigger database updates
   - Database updates trigger WebSocket broadcasts
   - Client updates UI based on WebSocket events

### Messages
1. Messages stored in database via REST API
2. Fetched through database queries
3. No real-time delivery (future enhancement opportunity)
4. Messages include:
   - Sender information
   - Timestamp
   - Content (with support for invite links)
   - Read/unread status

### Groups
1. Group data fetched from database on initial load
2. Group members loaded from database when selecting a group
3. All group operations use database queries via REST API
4. No WebSocket implementation for live updates

## State Management
- User session managed via NextAuth
- WebSocket context for status updates only
- Local state for:
  - Selected conversation
  - Message history
  - User lists
  - Group information

## API Integration

### Database Queries (REST)
- `/api/messages`: Message CRUD operations
- `/api/users`: User management and search
- `/api/groups`: Group operations
- `/api/invites`: Invitation handling
- `/api/status`: Status persistence

### WebSocket Events
- `statusChanged`: Only used for status updates
- Connection/disconnection handling
- No WebSocket implementation for messages or group updates

## UI Components

### CurrentUserStatus
- Initial status fetched from database
- Updates received via WebSocket
- Updates persisted to database

### GroupInviteButton
- Pure database operations
- No WebSocket integration
- Requires page refresh for updates

### StatusIndicator
- WebSocket-driven updates
- Backed by database persistence
- Real-time status reflection

## Error Handling
- Failed message delivery indicators (API response based)
- Error states for network issues
- Graceful degradation for offline functionality
- User feedback for all operations

## Performance Considerations
- Debounced status updates to reduce database writes
- Optimized re-renders
- Efficient WebSocket connection management
- Pagination for message history (TODO)

## Future Enhancements
1. Implement WebSocket for message delivery
2. Add WebSocket for group updates
3. Add typing indicators via WebSocket
4. Implement message read receipts