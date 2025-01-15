# Chat Page Documentation

## Overview
The chat page is a messaging interface that combines WebSocket connections for live status updates with REST API calls and polling mechanisms for message, mood, and group management.

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

### Mood System
- Mood updates via polling mechanism using `useMoodPolling` hook
- Default 3-second polling interval (configurable)
- Moods stored in `user_moods` table
- Mood operations:
  1. Set mood: POST to `/api/mood`
  2. Get mood: GET from `/api/mood/${userId}`
  3. Delete mood: DELETE from `/api/mood/${userId}`
- Efficient polling:
  - Only polls for visible users
  - Uses memoization to prevent unnecessary requests
  - Automatic cleanup on component unmount
- Display locations:
  - Under usernames in contact list
  - In group member list
  - In current user's status

### Message Updates
- Polling mechanism via `useMessagePolling` hook
- Default 3-second polling interval (configurable)
- Efficient updates using message ID tracking
- Supports both direct messages and group chats
- Automatic merging of new messages with existing ones
- Polling cleanup on component unmount

### Groups
- Group operations use REST API calls to database
- Create groups: POST to `/api/groups`
- Fetch groups: GET from `/api/groups/member`
- Member management: Database queries via `/api/groups/${id}/members`
- Message updates via polling system
- Invite system:
  - Generate: POST to `/api/groups/${id}/invites`
  - Accept: POST to `/api/invites/${id}/accept`

### Direct Messages
- Message sending: REST API calls to `/api/messages`
- Message updates via polling system
- Recent contacts: Database query to `/api/messages/contacts`
- User search: Database query to `/api/users`

## Data Flow

### Status Updates
1. Client connects to WebSocket server
2. Server queries database for initial status of all users
3. Status changes via WebSocket events and database updates

### Mood Updates
1. Initial mood fetched on component mount
2. Regular polling for visible users' moods:
   - Tracks visible users via useMemo
   - Only polls for users in view
   - Updates mood Map with new data
3. Mood changes:
   - POST request to update mood
   - Polling system picks up changes
   - UI updates automatically

### Messages
1. Messages stored in database via REST API
2. Regular polling checks for new messages:
   - Tracks last message ID
   - Only fetches newer messages
   - Merges with existing messages
   - Sorts by timestamp
3. Messages include:
   - Sender information
   - Timestamp
   - Content
   - Read/unread status

### Groups
1. Group data fetched from database on initial load
2. Group members loaded from database when selecting a group
3. Message updates handled by polling system
4. Group operations via REST API

## State Management
- User session managed via NextAuth
- WebSocket context for status updates
- Message polling hook for chat updates
- Mood polling hook for mood updates
- Local state for:
  - Selected conversation
  - Message history
  - User lists
  - Group information
  - Current mood

## API Integration

### Database Queries (REST)
- `/api/messages`: Message CRUD operations with polling support
- `/api/users`: User management and search
- `/api/groups`: Group operations
- `/api/invites`: Invitation handling
- `/api/status`: Status persistence

### WebSocket Events
- `statusChanged`: Only used for status updates
- Connection/disconnection handling

## UI Components

### CurrentUserStatus
- Initial status fetched from database
- Updates received via WebSocket
- Mood updates via API and polling
- Displays:
  - Online status indicator
  - Username
  - Current mood
  - Mood input field

### UserListItem
- Reusable component for user display
- Shows:
  - Status indicator
  - Username
  - Current mood
- Used in:
  - Recent contacts
  - Group members list

### ChatArea
- Uses `useMessagePolling` hook
- Supports both direct and group messages
- Automatic message updates
- Efficient message merging

### StatusIndicator
- WebSocket-driven updates
- Backed by database persistence
- Real-time status reflection

## Performance Considerations
- Debounced status updates
- Efficient polling with:
  - Last message ID tracking
  - Visible users only for moods
  - Automatic cleanup
- Optimized message merging
- Configurable polling intervals
- Memoized user lists

## Future Enhancements
1. Implement WebSocket for message delivery (alternative to polling)
2. Add WebSocket for group updates
3. Add typing indicators via WebSocket
4. Implement message read receipts
5. Add WebSocket for mood updates (alternative to polling)
6. Add mood history
7. Add mood reactions
8. Implement mood expiration

### Component Interactions
The components work together to create a cohesive chat experience:

1. **Group & Thread Navigation**
   ```
   GroupList
   └── ThreadList
       └── Thread Selection -> Chat Area
   ```

2. **Message Interactions**
   ```
   Message
   └── MessageReactions
       └── EmojiPicker
   ```

### Performance Considerations
- Components use `useState` for local state management
- Click handlers are memoized where appropriate
- Modals and pickers are conditionally rendered
- Lists implement efficient rendering patterns

### Accessibility Features
- ARIA labels on interactive elements
- Keyboard navigation support
- Clear visual feedback for interactions
- Screen reader friendly structure

### Styling Patterns
- Consistent use of Tailwind classes
- Responsive design considerations
- Theme-aware color schemes
- Interactive state styling

### Future Component Enhancements
1. Virtual scrolling for large thread lists
2. Rich emoji picker with categories and search
3. Reaction analytics and trending reactions
4. Thread pinning and sorting options
5. Enhanced thread creation with templates
6. Drag-and-drop thread organization
7. Thread archiving functionality
8. Advanced thread filtering and search
