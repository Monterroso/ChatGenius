# Database Schema Documentation

## Overview

Our application uses incremental SQL migrations to manage the database schema. Each migration builds upon the previous one to add or modify tables, columns, constraints, and triggers. We use direct database interactions through:

```javascript
import db from '@/lib/db';
```

Key principles:
- No Prisma ORM - direct database interactions only
- Detailed SQL comments for clarity
- Robust constraints and triggers for data integrity
- Minimal application-layer validation

## Core Tables

### 1. Users (`users`)

Stores all user accounts in the system.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `name` | VARCHAR(255) | Display name |
| `username` | VARCHAR(255) | Unique login handle |
| `email` | VARCHAR(255) | Unique email address |
| `password` | VARCHAR(255) | Hashed password |
| `created_at` | TIMESTAMP WITH TIME ZONE | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Last update timestamp |

### 2. User Status (`user_status`)

Tracks user presence and device information.

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | UUID | References users(id) |
| `manual_status` | TEXT | One of: 'online', 'away', 'dnd', 'offline' |
| `invisible` | BOOLEAN | Hide user from presence indicators |
| `last_seen` | TIMESTAMP WITH TIME ZONE | Last activity timestamp |
| `devices` | JSONB | Array of connected devices |
| `created_at` | TIMESTAMP WITH TIME ZONE | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Last update timestamp |

### 3. Groups (`groups`)

Manages chat groups and threads.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `name` | VARCHAR(255) | Group name |
| `is_primary` | BOOLEAN | Primary group indicator |
| `parent_group_id` | UUID | Optional parent group for threads |
| `created_at` | TIMESTAMP WITH TIME ZONE | Creation timestamp |

**Note**: Single-level nesting only - threads cannot have sub-threads.

### 4. Group Members (`group_members`)

Tracks group membership.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `user_id` | UUID | References users(id) |
| `group_id` | UUID | References groups(id) |
| `joined_at` | TIMESTAMP WITH TIME ZONE | Join timestamp |

### 5. Messages (`messages`)

Core message storage.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `content` | TEXT | Message content |
| `sender_id` | UUID | References users/bots |
| `receiver_id` | UUID | Optional direct message recipient |
| `group_id` | UUID | Optional group reference |
| `sender_type` | VARCHAR(10) | 'user' or 'bot' |
| `receiver_type` | VARCHAR(10) | 'user' or 'bot' |
| `deleted_at` | TIMESTAMP WITH TIME ZONE | Soft deletion timestamp |
| `conversation_id` | UUID | Deprecated - formerly referenced bot_conversations |
| `reply_to_message_id` | UUID | Optional replied message reference |
| `parent_thread_id` | UUID | Optional thread parent reference |
| `thread_depth` | INTEGER | Thread nesting level |
| `conversation_context` | JSONB | Conversation metadata |
| `is_automated_response` | BOOLEAN | Auto-response indicator |
| `is_bot_generated` | BOOLEAN | Bot generation indicator |
| `original_message_id` | UUID | Reference to triggering message |
| `created_at` | TIMESTAMP WITH TIME ZONE | Creation timestamp |

### 2. User Moods (`user_moods`)

Tracks user mood states.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `user_id` | UUID | References users(id) |
| `mood` | TEXT | User's current mood |
| `created_at` | TIMESTAMP WITH TIME ZONE | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Last update timestamp |

A trigger automatically updates the `updated_at` timestamp whenever the mood changes.

## Supporting Tables

### 6. Group Invites (`group_invites`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `group_id` | UUID | References groups(id) |
| `expires_at` | TIMESTAMP WITH TIME ZONE | Expiration timestamp |
| `created_at` | TIMESTAMP WITH TIME ZONE | Creation timestamp |

### 7. Reactions (`reactions`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `message_id` | UUID | References messages(id) |
| `user_id` | UUID | References users(id) |
| `emoji` | VARCHAR(20) | Reaction emoji |
| `created_at` | TIMESTAMP WITH TIME ZONE | Creation timestamp |

### 8. Files (`files`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `group_id` | UUID | Optional group reference |
| `receiver_id` | UUID | Optional direct recipient |
| `uploader_id` | UUID | References users(id) |
| `filename` | VARCHAR(255) | Original filename |
| `filetype` | VARCHAR(50) | MIME type |
| `filesize` | BIGINT | File size in bytes |
| `file_data` | BYTEA | Binary file content |
| `created_at` | TIMESTAMP WITH TIME ZONE | Creation timestamp |

## AI and Bot Support

### 9. Bot Users (`bot_users`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `name` | VARCHAR(255) | Unique bot name |
| `api_key` | TEXT | Optional API key |
| `personality` | TEXT | Bot personality definition |
| `user_id` | UUID | Optional owner reference |
| `is_system_bot` | BOOLEAN | System bot indicator |
| `created_at` | TIMESTAMP WITH TIME ZONE | Creation timestamp |

Note: Several bot-related tables (bot_metrics, bot_errors, bot_knowledge, bot_commands, bot_conversations) were removed in migration 014 as they were no longer used in the application.

### 10. Bot Feedback (`bot_feedback`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `bot_id` | UUID | References bot_users(id) |
| `user_id` | UUID | References users(id) |
| `conversation_id` | UUID | References bot_conversations(id) |
| `message_index` | INTEGER | Message sequence number |
| `rating` | INTEGER | 1-5 rating |
| `feedback_text` | TEXT | Optional feedback text |
| `response_time_ms` | INTEGER | Response latency |
| `token_count` | INTEGER | Token usage |
| `metadata` | JSONB | Additional metadata |
| `created_at` | TIMESTAMP WITH TIME ZONE | Creation timestamp |

### 11. Message Embeddings (`message_embeddings`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `message_id` | UUID | References messages(id) |
| `embedding` | vector(1536) | Message vector embedding |
| `metadata` | JSONB | Additional metadata |
| `retrieval_count` | INTEGER | Times retrieved |
| `last_retrieved_at` | TIMESTAMP WITH TIME ZONE | Last retrieval timestamp |
| `created_at` | TIMESTAMP WITH TIME ZONE | Creation timestamp |

## Common Workflows

### Creating a New Group
1. Insert into `groups` with name and primary status
2. Add members via `group_members`
3. Messages reference group via `group_id`

### Direct Messaging
1. Insert into `messages` with:
   - `sender_id` and `receiver_id`
   - `sender_type = 'user'`
   - `receiver_type = 'user' or 'bot'`
   - No `group_id`

### Bot Auto-Responses
1. User message triggers system
2. Insert new message with:
   - `is_automated_response = true`
   - `original_message_id` linking to trigger
   - `sender_id` referencing system bot
   - `sender_type = 'bot'`
   - `receiver_id` referencing the original message sender
   - `receiver_type = 'user'`

### File Sharing
1. Insert into `files` with:
   - Either `group_id` OR `receiver_id`
   - Binary data in `file_data`
   - Required metadata (filename, type, size)

## Design Principles

1. **Extensibility**: Incremental migrations for feature growth
2. **Data Integrity**: Robust constraints and triggers
3. **Performance**: Optimized indexes for common queries
4. **Maintenance**: Automated cleanup of stale data
5. **Clear Boundaries**: Database-level validation

## Future Development

- Add features via SQL migrations
- Use `import db from '@/lib/db'` for database access
- Rely on database constraints for data integrity
- Remove unused tables as needed