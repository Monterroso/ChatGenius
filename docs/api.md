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
  - Request example:
    ```typescript
    POST /api/auth/signin
    {
      "email": "user@example.com",
      "password": "yourpassword"
    }
    ```
  - Response example:
    ```typescript
    {
      "user": {
        "id": "123",
        "name": "John Doe",
        "username": "johndoe",
        "email": "user@example.com"
      }
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
  - Response example:
    ```typescript
    [
      {
        "id": "123",
        "name": "Team Chat",
        "created_at": "2024-03-20T15:30:00Z",
        "is_primary": false
      },
      {
        "id": "456",
        "name": "General",
        "created_at": "2024-03-20T15:30:00Z",
        "is_primary": true
      }
    ]
    ```

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
  - Request example:
    ```typescript
    {
      "name": "New Project Team"
    }
    ```
  - Response example:
    ```typescript
    {
      "id": "789",
      "name": "New Project Team",
      "created_at": "2024-03-20T15:30:00Z",
      "is_primary": false
    }
    ```

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
  - Response example:
    ```typescript
    [
      {
        "user_id": "123",
        "group_id": "456",
        "joined_at": "2024-03-20T15:30:00Z",
        "name": "John Doe",
        "username": "johndoe"
      }
    ]
    ```

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
  - Request example:
    ```typescript
    {
      "content": "Hello team!"
    }
    ```
  - Response example:
    ```typescript
    {
      "id": "123",
      "content": "Hello team!",
      "created_at": "2024-03-20T15:30:00Z",
      "sender_id": "456",
      "sender_name": "John Doe",
      "sender_username": "johndoe",
      "group_id": "789"
    }
    ```

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
    - groupId - For group messages
    - userId - For direct messages
  - Returns last 50 messages
  - Includes sender/receiver details
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
  - Required: content and either groupId or receiverId
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

## Reactions
- `POST /api/reactions`
  - Adds reaction to message
  - Required fields in request body:
    ```typescript
    {
      messageId: string;
      emoji: string;
    }
    ```
  - Returns updated reactions list:
    ```typescript
    {
      reactions: Array<{
        id: string;
        message_id: string;
        user_id: string;
        emoji: string;
        created_at: string;
        name: string;
        username: string;
      }>
    }
    ```
  - Requires authentication
  - Request example:
    ```typescript
    {
      "messageId": "123",
      "emoji": "👍"
    }
    ```
  - Response example:
    ```typescript
    {
      "reactions": [
        {
          "id": "456",
          "message_id": "123",
          "user_id": "789",
          "emoji": "👍",
          "created_at": "2024-03-20T15:30:00Z",
          "name": "John Doe",
          "username": "johndoe"
        }
      ]
    }
    ```

- `DELETE /api/reactions`
  - Removes a reaction from a message.
  - Required fields in request body:
    ```typescript
    {
      messageId: string;
      emoji: string;
    }
    ```
  - Deletes the specified reaction if it exists for (messageId, userId, emoji).
  - Returns the updated list of reactions for the message:
    ```typescript
    {
      reactions: Array<{
        id: string;
        message_id: string;
        user_id: string;
        emoji: string;
        created_at: string;
        name: string;
        username: string;
      }>
    }
    ```
  - Requires authentication.

- `GET /api/messages/[id]/reactions`
  - Gets reactions for a message
  - Groups reactions by emoji
  - Response format:
    ```typescript
    {
      reactions: Record<string, Array<{ 
        userId: string; 
        name: string; 
        username: string; 
      }>>;
    }
    ```
  - Requires authentication

## Files
- `GET /api/files/[id]`
  - Gets file metadata and download URL
  - Response example:
    ```typescript
    {
      "id": "123",
      "filename": "document.pdf",
      "filepath": "/uploads/123-document.pdf",
      "filetype": "application/pdf",
      "filesize": 1024567,
      "uploaded_at": "2024-03-20T15:30:00Z",
      "downloadUrl": "/uploads/123-document.pdf"
    }
    ```

- `DELETE /api/files/[id]`
  - Response example:
    ```typescript
    {
      "success": true
    }
    ```

- `GET /api/files/[id]/download`
  - Returns file with appropriate headers
  - Response headers example:
    ```typescript
    {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=\"document.pdf\"",
      "Content-Length": "1024567"
    }
    ```

- `POST /api/files/upload`
  - Request example (FormData):
    ```typescript
    const formData = new FormData();
    formData.append('file', fileObject);
    formData.append('groupId', '123'); // or
    formData.append('receiverId', '456');
    ```
  - Response example:
    ```typescript
    {
      "id": "123",
      "filename": "image.jpg",
      "filepath": "/uploads/123-image.jpg",
      "filetype": "image/jpeg",
      "filesize": 512000,
      "uploaded_at": "2024-03-20T15:30:00Z"
    }
    ```

## Groups
- `GET /api/groups/[id]/files`
  - Response example:
    ```typescript
    [
      {
        "id": "123",
        "filename": "document.pdf",
        "filepath": "/uploads/123-document.pdf",
        "filetype": "application/pdf",
        "filesize": 1024567,
        "uploaded_at": "2024-03-20T15:30:00Z",
        "uploader_name": "John Doe",
        "uploader_username": "johndoe"
      }
    ]
    ```

## Mood
- `GET /api/mood/[userId]`
  - Response example:
    ```typescript
    {
      "user_id": "123",
      "mood": "😊",
      "updated_at": "2024-03-20T15:30:00Z"
    }
    ```

- `DELETE /api/mood/[userId]`
  - Response example:
    ```typescript
    {
      "message": "Mood deleted"
    }
    ```

- `POST /api/mood`
  - Request example:
    ```typescript
    {
      "mood": "🎉"
    }
    ```
  - Response example:
    ```typescript
    {
      "user_id": "123",
      "mood": "🎉",
      "updated_at": "2024-03-20T15:30:00Z"
    }
    ```

## Bots
- `GET /api/bots`
  - Requires a valid session
  - Fetches a list of all bots belonging to the current user
  - Returns bot ID, name, and personality
  - Response format:
    ```typescript
    Array<{
      id: string;
      name: string;
      personality: string;
    }>
    ```

- `POST /api/bots`
  - Creates a new bot associated with the current user
  - Required fields: name
  - Optional fields: personality, api_key
  - Request body:
    ```typescript
    {
      name: string;
      personality?: string;
      api_key?: string;
    }
    ```
  - Returns the newly created bot's details
  - Requires authentication

- `DELETE /api/bots`
  - Deletes a bot by ID (passed via query parameter)
  - Requires a valid session and the bot's ID
  - Returns success confirmation
  - Response format:
    ```typescript
    {
      success: boolean;
    }
    ```

## Bot Chat
- `POST /api/bots/chat`
  - Expects a valid session and bot identification
  - Lets a user send a message to a bot
  - Immediately stores the user's message in the database
  - Asynchronously processes bot's response using:
    - Command parser (if message starts with "/")
    - RAG (Retrieval-Augmented Generation) system
  - Request body:
    ```typescript
    {
      botId: string;
      message: string;
    }
    ```
  - Response format:
    ```typescript
    {
      messageId: string;
      status: "processing" | "completed";
    }
    ```

## Bot Conversations
- `GET /api/bots/[id]/conversations/latest`
  - Finds the latest active conversation for the specified bot and current user
  - Returns the single conversation ID if found
  - Response format:
    ```typescript
    {
      conversationId: string | null;
    }
    ```
  - Requires authentication

## Bot Feedback
- `POST /api/bots/feedback`
  - Submits feedback on a bot conversation
  - Request body:
    ```typescript
    {
      botId: string;
      conversationId: string;
      rating?: number;
      feedbackText?: string;
      metadata?: Record<string, any>;
    }
    ```
  - Returns newly created feedback record ID
  - Requires authentication

- `GET /api/bots/feedback`
  - Returns either:
    - Aggregated metrics about bot usage
    - History of feedback entries
  - Query parameters:
    - type: "metrics" | "history"
    - limit?: number
    - offset?: number
  - Response format for metrics:
    ```typescript
    {
      totalConversations: number;
      averageRating: number;
      responseTimeMs: number;
      totalTokens: number;
    }
    ```
  - Response format for history:
    ```typescript
    Array<{
      id: string;
      rating: number;
      feedbackText: string;
      createdAt: string;
      metadata: Record<string, any>;
    }>
    ```
  - Requires authentication

## Message Threads
- `GET /api/messages/[id]/thread`
  - Recursively fetches a message and all its replies
  - Forms a threaded conversation
  - Checks user's permission to view (group membership or direct message context)
  - Returns messages in chronological order
  - Response format:
    ```typescript
    Array<{
      id: string;
      content: string;
      created_at: string;
      sender_id: string;
      sender_name: string;
      sender_username: string;
      parent_id?: string;
    }>
    ```
  - Requires authentication

- `POST /api/messages/[id]/reply`
  - Creates a new message replying to an existing one
  - Inherits context (group or user conversation) from original message
  - Request body:
    ```typescript
    {
      content: string;
    }
    ```
  - Returns the newly created reply with sender details
  - Requires authentication

## Group Threads
- `POST /api/groups/[id]/threads`
  - Creates a "thread" (subgroup) inside the specified parent group
  - Validates membership in parent group
  - Adds creator as thread member
  - Inserts system message in parent group announcing new thread
  - Request body:
    ```typescript
    {
      name: string;
      description?: string;
    }
    ```
  - Response format:
    ```typescript
    {
      id: string;
      name: string;
      description?: string;
      parent_group_id: string;
      created_at: string;
    }
    ```
  - Requires authentication

- `GET /api/groups/[id]/threads`
  - Lists all threads belonging to the specified parent group
  - Includes message counts for each thread
  - Response format:
    ```typescript
    Array<{
      id: string;
      name: string;
      description?: string;
      message_count: number;
      last_activity: string;
      created_at: string;
    }>
    ```
  - Requires authentication and membership in parent group

