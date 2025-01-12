# Emoji Reactions Checklist

This checklist outlines the implementation steps for adding emoji reactions to messages in your chat application.

---

## **Backend**

### **Database Schema**
- [ ] Add `reactions` table to store emoji reactions:
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
- [ ] **POST `/api/reactions`**:
  - [ ] Request body: `{ messageId: string, emoji: string }`
  - [ ] Validates that:
    - [ ] The message exists and has not been deleted.
    - [ ] The user has not already reacted with the same emoji to the message.
  - [ ] Adds a new reaction to the `reactions` table.
  - [ ] Returns updated reactions for the message.

- [ ] **DELETE `/api/reactions`**:
  - [ ] Request body: `{ messageId: string, emoji: string }`
  - [ ] Validates that the reaction exists and belongs to the requesting user.
  - [ ] Removes the specified emoji reaction from the `reactions` table.
  - [ ] Returns updated reactions for the message.

- [ ] **GET `/api/messages/[id]/reactions`**:
  - [ ] Fetches all reactions for a specific message.
  - [ ] Includes:
    - [ ] Emoji types.
    - [ ] User details (e.g., `userId`, `username`) for each reaction.
  - [ ] Returns the reaction data.

---

## **Frontend**

### **UI Components**
- [ ] **Message Component**:
  - [ ] Display reactions below each message.
  - [ ] Include hover functionality to show users who reacted with each emoji.

- [ ] **Reaction Input**:
  - [ ] Add an emoji picker or reaction button for users to select emojis.
  - [ ] Ensure users can click on their emoji to remove their reaction.

### **Features**
- [ ] **Add Reaction**:
  - [ ] Allow users to react to messages using emojis.
  - [ ] Disable duplicate reactions (same emoji by the same user).

- [ ] **Remove Reaction**:
  - [ ] Allow users to remove their emoji reaction by clicking on it.

- [ ] **Reaction Visibility**:
  - [ ] Ensure all users can see reactions below messages.
  - [ ] Include a hover effect that shows a list of users who reacted with each emoji.

### **State Management**
- [ ] Fetch reactions data for each message during polling updates.
- [ ] Update message state locally when a reaction is added or removed.
- [ ] Ensure UI is updated immediately upon user interaction.

### **Validation and Restrictions**
- [ ] Prevent users from reacting to deleted messages (validated on the backend).
- [ ] Disable the reaction button if the message is flagged as deleted.

### **Accessibility**
- [ ] Ensure emoji reactions are accessible via keyboard navigation.
- [ ] Add ARIA labels for emojis and reaction lists.

### **Testing**
- [ ] Verify users can:
  - [ ] React to a message with an emoji.
  - [ ] Remove their reaction.
  - [ ] See reactions and the users who reacted.
- [ ] Validate the following edge cases:
  - [ ] Duplicate emoji reactions by the same user are prevented.
  - [ ] Users cannot react to deleted messages.
  - [ ] Reactions are accurately displayed after adding or removing.

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
