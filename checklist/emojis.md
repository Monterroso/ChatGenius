# Emoji Reactions Checklist

This checklist outlines the implementation steps for adding emoji reactions to messages in your chat application.

---

## **Backend**

### **Database Schema**
- [x] Add `reactions` table to store emoji reactions:
  ```sql
  CREATE TABLE reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (message_id, user_id, emoji)
  );
  ```

### **API Endpoints**
- [x] **POST `/api/reactions`**:
  - [x] Request body: `{ messageId: string, emoji: string }`
  - [x] Validates that:
    - [x] The message exists and has not been deleted.
    - [x] The user has not already reacted with the same emoji to the message.
  - [x] Adds a new reaction to the `reactions` table.
  - [x] Returns updated reactions for the message.

- [x] **DELETE `/api/reactions`**:
  - [x] Request body: `{ messageId: string, emoji: string }`
  - [x] Validates that the reaction exists and belongs to the requesting user.
  - [x] Removes the specified emoji reaction from the `reactions` table.
  - [x] Returns updated reactions for the message.

- [x] **GET `/api/messages/[id]/reactions`**:
  - [x] Fetches all reactions for a specific message.
  - [x] Includes:
    - [x] Emoji types.
    - [x] User details (e.g., `userId`, `username`) for each reaction.
  - [x] Returns the reaction data.

### **Implementation Notes**
- [x] **Emoji Storage**:
  - Use Unicode emoji characters (e.g., "👍", "❤️", "😊")
  - Benefits:
    - No image storage needed
    - Native rendering across platforms
    - Smaller database footprint
    - Consistent with modern chat applications
  - Implementation:
    ```typescript
    // Example of storing in database
    emoji VARCHAR(20) NOT NULL // Can store Unicode emoji characters directly
    ```

- [x] **Common Reactions**:
  - Recommended default reactions:
    - 👍 (thumbs up)
    - ❤️ (heart)
    - 😊 (smile)
    - 😂 (joy)
    - 👏 (clap)
    - 🎉 (celebration)

---

## **Frontend**

### **UI Components**
- [x] **Message Component**:
  - [x] Display reactions below each message.
  - [x] Include hover functionality to show users who reacted with each emoji.

- [x] **Reaction Input**:
  - [x] Add an emoji picker or reaction button for users to select emojis.
  - [x] Ensure users can click on their emoji to remove their reaction.

### **Features**
- [x] **Add Reaction**:
  - [x] Allow users to react to messages using emojis.
  - [x] Disable duplicate reactions (same emoji by the same user).

- [x] **Remove Reaction**:
  - [x] Allow users to remove their emoji reaction by clicking on it.

- [x] **Reaction Visibility**:
  - [x] Ensure all users can see reactions below messages.
  - [x] Include a hover effect that shows a list of users who reacted with each emoji.

### **State Management**
- [x] Fetch reactions data for each message during polling updates.
- [x] Update message state locally when a reaction is added or removed.
- [x] Ensure UI is updated immediately upon user interaction.

### **Validation and Restrictions**
- [x] Prevent users from reacting to deleted messages (validated on the backend).
- [x] Disable the reaction button if the message is flagged as deleted.

### **Accessibility**
- [x] Ensure emoji reactions are accessible via keyboard navigation.
- [x] Add ARIA labels for emojis and reaction lists.

### **Testing**
- [ ] Verify users can:
  - [ ] React to a message with an emoji.
  - [ ] Remove their reaction.
  - [ ] See reactions and the users who reacted.
- [ ] Validate the following edge cases:
  - [ ] Duplicate emoji reactions by the same user are prevented.
  - [ ] Users cannot react to deleted messages.
  - [ ] Reactions are accurately displayed after adding or removing.

### **Real-time Updates**
- [x] **Reaction Polling**:
  - [x] Create a `useReactionPolling` hook
  - [x] Poll reactions for visible messages every 3-5 seconds
  - [x] Optimize by only polling for visible messages
  - [x] Handle race conditions between local updates and polling
  - [x] Add error handling and retry logic

---

## **Quality Assurance Checklist**

### **Functional Tests**
- [ ] Users can add a reaction to a message.
- [ ] Users can remove their reaction.
- [ ] Reactions are displayed below messages.
- [ ] Hovering over an emoji shows the list of users who reacted.

### **Edge Cases**
- [ ] Adding duplicate reactions with the same emoji is blocked.
- [ ] Users cannot react to messages flagged as deleted.
- [ ] Removing a reaction does not affect other reactions.

### **Performance Tests**
- [ ] Reaction updates are reflected within the polling interval.
- [ ] UI updates are smooth and responsive.

### **UI/UX Tests**
- [ ] Emoji reactions are visually appealing and consistent across devices.
- [ ] Hover effects are responsive and show correct user details.
- [ ] Reaction input is intuitive and easy to use.

---

This checklist can be used to ensure all necessary features and requirements for emoji reactions are implemented and tested thoroughly.
