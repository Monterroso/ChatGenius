# API Routes Documentation

## Authentication
- `POST /api/auth/[...nextauth]` - NextAuth.js authentication handler
  - Handles login/logout and session management
  - Uses credentials provider with email/password
  - Returns JWT containing:
    - User ID
    - Name
    - Username
    - Email
  - Custom session includes user ID, name, and username
  - Request body:
    ```typescript
    {
      email: string;
      password: string;
    }
    ```

## Signup
- `POST /api/signup`
  - Creates new user account
  - Required fields: name, username, email, password
  - Validations:
    - Username uniqueness
    - Email uniqueness
    - Name length (max 15 characters)
    - Password strength (min 8 characters)
  - Auto-creates default group if not exists (name from env: DEFAULT_GROUP_NAME)
  - Auto-joins user to default group
  - Creates initial status record for user
  - Uses transaction to ensure data consistency
  - Request body:
    ```typescript
    {
      name: string;
      username: string;
      email: string;
      password: string;
    }
    ```
  - Returns: `{ userId: string, message: string }`

## Groups
- `GET /api/groups`
  - Lists all groups
  - Returns: id, name, created_at
  - Sorted by primary status and creation date
  - Response format:
    ```typescript
    Array<{
      id: string;
      name: string;
      created_at: string;
      is_primary: boolean;
    }>
    ```
  - Requires authentication

- `POST /api/groups`
  - Creates new group
  - Required fields: name
  - Validates name is non-empty
  - Auto-adds creator as first member
  - Request body:
    ```typescript
    {
      name: string;
    }
    ```
  - Returns created group details
  - Requires authentication

- `GET /api/groups/member`
  - Lists all groups the authenticated user is a member of
  - Returns full group details
  - Sorted by primary status and creation date
  - Response format:
    ```typescript
    Array<{
      id: string;
      name: string;
      created_at: string;
      is_primary: boolean;
    }>
    ```
  - Requires authentication

- `GET /api/groups/[id]`
  - Returns group details and member list
  - Includes:
    - Group details (all fields)
    - Member list with join dates
    - Member details (id, name, username)
  - Response format:
    ```typescript
    {
      group: {
        id: string;
        name: string;
        created_at: string;
        is_primary: boolean;
      };
      members: Array<{
        id: string;
        name: string;
        username: string;
        joined_at: string;
      }>;
    }
    ```
  - Requires authentication

- `GET /api/groups/[id]/members`
  - Lists all members of a specific group
  - Returns: user_id and group_id pairs
  - Response format:
    ```typescript
    Array<{
      user_id: string;
      group_id: string;
    }>
    ```
  - Requires authentication

- `GET /api/groups/[id]/messages`
  - Retrieves last 50 messages for group
  - Includes sender details (name, username)
  - Sorted by creation date (DESC)
  - Response format:
    ```typescript
    Array<{
      id: string;
      content: string;
      created_at: string;
      sender_id: string;
      sender_name: string;
      sender_username: string;
    }>
    ```
  - Requires authentication

- `POST /api/groups/[id]/messages`
  - Creates new group message
  - Required fields: content
  - Request body:
    ```typescript
    {
      content: string;
    }
    ```
  - Returns created message with full details
  - Requires authentication

- `POST /api/groups/[id]/invites`
  - Creates new invite for a group
  - Validates group membership
  - Sets 7-day expiration
  - Returns invite ID
  - Response format:
    ```typescript
    {
      inviteId: string;
    }
    ```
  - Requires authentication

## Invites
- `GET /api/invites/[inviteId]`
  - Get invite information
  - Returns group name for valid invites
  - Validates invite format (alphanumeric + dash)
  - Checks expiration
  - Response format:
    ```typescript
    {
      groupName: string;
    }
    ```
  - No authentication required

- `POST /api/invites/[inviteId]/accept`
  - Accept an invite and join group
  - Validates:
    - Invite existence and expiration
    - User not already a member
  - Returns success status
  - Response format:
    ```typescript
    {
      success: boolean;
    }
    ```
  - Requires authentication

## Messages
- `GET /api/messages`
  - Fetches messages filtered by:
    - `groupId` - Group messages
    - `userId` - Direct messages
  - Returns last 50 messages
  - Includes sender and receiver details
  - Sorted by creation date (ASC)
  - Query parameters:
    - groupId?: string
    - userId?: string
  - Response format:
    ```typescript
    Array<{
      id: string;
      content: string;
      created_at: string;
      sender_id: string;
      sender_name: string;
      sender_username: string;
      receiver_id?: string;
      receiver_name?: string;
      receiver_username?: string;
      group_id?: string;
    }>
    ```
  - Requires authentication

- `POST /api/messages`
  - Creates new message
  - Required fields: content, and either groupId or receiverId (not both)
  - Request body:
    ```typescript
    {
      content: string;
      groupId?: string;
      receiverId?: string;
    }
    ```
  - Returns created message details
  - Requires authentication

- `GET /api/messages/contacts`
  - Lists unique users who have exchanged messages with current user
  - Returns array of user IDs
  - Includes both sent and received messages
  - Response format:
    ```typescript
    Array<string> // Array of user IDs
    ```
  - Requires authentication

## Users
- `GET /api/users`
  - Lists all users except current user
  - Returns user data with:
    - id
    - name 
    - username
    - status (calculated effective status)
    - lastSeen
  - Status is calculated using:
    - Manual status
    - Auto status (defaults to 'offline')
    - Invisible flag
    - Last seen timestamp
    - Connected devices
  - Response format:
    ```typescript
    Array<{
      id: string;
      name: string;
      username: string;
      status: string;
      lastSeen: string | null;
    }>
    ```
  - Requires authentication

## Status
- `GET /api/status`
  - Returns current user's status information
  - Returns calculated effective status based on:
    - Manual status
    - Auto status
    - Invisible flag
    - Last seen timestamp
    - Connected devices
  - Response format:
    ```typescript
    {
      status: string;
      lastSeen: string | null;
    }
    ```
  - Returns 404 if status not found
  - Requires authentication

- `PUT /api/status`
  - Updates user's status
  - Supports device-aware status updates
  - Updates last_seen timestamp automatically
  - Request body format:
    ```typescript
    {
      status?: string;
      autoStatus?: string;
      manualStatus?: string;
      deviceId?: string;
      userAgent?: string;
    }
    ```
  - Returns calculated effective status
  - Requires authentication

- `POST /api/status`
  - Creates initial status record
  - Request body format:
    ```typescript
    {
      manual_status?: string;
      auto_status?: string;
      invisible?: boolean;
    }
    ```
  - Returns calculated effective status
  - Requires authentication

- `GET /api/status/[userId]`
  - Get specific user's status
  - Returns calculated effective status
  - Response format:
    ```typescript
    {
      status: string;
      lastSeen: string | null;
    }
    ```
  - Requires authentication

## Socket
- `GET /api/socket`
  - Returns Socket.IO server URL configuration
  - Response format: `{ socketUrl: string }`
  - Environment variables:
    - `NEXT_PUBLIC_SOCKET_URL` - Custom socket server URL
    - `SOCKET_PORT` - Custom socket port
    - Falls back to `ws://localhost:3001` if not set
  - Headers: `Content-Type: application/json`
  - No authentication required
  - Force dynamic route (no caching)
  - Used by client to determine WebSocket connection endpoint

## Socket Server (WebSocket)
- Runs on port 3001 (configurable via `SOCKET_PORT`)
- Handles real-time status updates:
  - User connections/disconnections
  - Status changes ('online', 'offline', etc.)
- Events:
  - `connection`: New socket connection
  - `statusChange`: User updates their status
  - `disconnect`: Socket disconnection
- Emits:
  - `userStatusChanged`: `{ userId: string, status: string }`
  - `initialStatuses`: Current status state for all users
- CORS configured to match Next.js app URL
  - Uses `NEXT_PUBLIC_APP_URL` or defaults to `http://localhost:3000`

## Security
- All routes require authentication except:
  - `/api/auth/[...nextauth]`
  - `/api/signup`
  - `/api/invites/[inviteId]` (GET only)
  - `/api/socket`
- Uses NextAuth.js session validation
- Password hashing with bcrypt
- SQL injection protection via parameterized queries
- Transaction support for data consistency