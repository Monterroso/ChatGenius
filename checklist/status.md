# Proposed Checklist & Implementation Steps for a Periodic Polling–Based Status System

Below is a high-level checklist that builds on your existing database schema, status calculation utilities, and polling hooks. Since you already have a working “user_status” table, a “calculateEffectiveStatus” function, and a “useStatusPolling” hook, most of the infrastructure is there.

---

## 1. Database Schema & Migration

1. **Confirm user_status table.** Ensure you have the following columns (which you already do):  
   - user_id (UUID, Primary Key)  
   - manual_status (TEXT, nullable)  
   - invisible (BOOLEAN, default false)  
   - last_seen (TIMESTAMP WITH TIME ZONE, default CURRENT_TIMESTAMP)  
   - devices (JSONB, default '[]')  
   - created_at, updated_at (TIMESTAMP WITH TIME ZONE)

2. **Use last_seen for status calculation**
   - If `(now - user_status.last_seen) > inactivityThreshold`, user is considered "away"  
   - If no devices are connected for a certain duration or `(now - user_status.last_seen) > offlineThreshold`, user is considered "offline"

3. **(Optional) Keep triggers/functions for stale devices.**  
   - For example: removing device entries not active for 5+ minutes.

---

## 2. API Layer

1. **PUT /api/status**  
   - Already exists. Confirm it updates `last_seen` on every user interaction.  
   - Allows updating `manual_status` if a user explicitly chooses “dnd,” etc.

2. **GET /api/status/[userId]**  
   - Returns a JSON object from your “calculateEffectiveStatus” function.  
   - Determines if the user is “online,” “away,” or “offline” based on `last_seen`, `devices`, and “invisible” flag.

3. **Polling Strategy**  
   - Use your `useStatusPolling` hook to call GET /api/status/[userId] for each user.  
   - Ensure the front end calls `PUT /api/status` whenever the local user interacts (click, keystroke, etc.).

---

## 3. Front-End Hooks & Components

1. **useStatusPolling (already in codebase)**  
   - Poll each user’s status via an interval (e.g., 2–3 seconds).  
   - Only poll for relevant users (group members, direct chat participants).

2. **Capture Local Interactions**  
   - Listen to user clicks/key presses in your main chat area.  
   - Throttle/debounce these events, then call `PUT /api/status` to update `last_seen`.

3. **Calculate Effective Status**  
   - If `(now - last_seen)` exceeds your “away” threshold, mark them “away.”  
   - If no devices or time exceeds an “offline” threshold, mark them “offline.”  
   - If “manual_status” is set to “dnd,” display that instead.

4. **Display**  
   - Show “online,” “away,” or “offline” next to each user in the chat UI.  
   - If `invisible` is true, show them as “offline” to others while treating them as “online” on their own UI.

---

## 4. Logic for Marking “Away” vs. “Offline”

1. **Away**  
   - If `(now - last_seen) > awayThreshold` but `< offlineThreshold`, user is considered "away"

2. **Offline**  
   - If `(now - last_seen) > offlineThreshold` or if devices is empty, user is considered "offline"

3. **Manual Status**  
   - Takes precedence over calculated status when user is recently active

---

## 5. Implementation Outline

1. **Database**  
   - Retain or add the `last_seen` column in `user_status`.  
   - Optionally add triggers for device cleanup.

2. **API**  
   - `PUT /api/status`: Triggered on user interaction to update `last_seen`.  
   - `GET /api/status/[userId]`: Returns the computed status.

3. **Polling**  
   - `useStatusPolling` fetches each user’s status every few seconds.  
   - The server calculates “online,” “away,” “offline,” etc.

4. **UI Updates**  
   - In the user list or conversation, show the polled status.  
   - Respect the `invisible` flag by displaying them as “offline” to others.

With this approach, you have a stable production-ready solution for status updates based on periodic polling, without relying on WebSockets. 