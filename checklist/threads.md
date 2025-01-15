# Thread Support Checklist

This checklist outlines the steps for adding thread support as simplified sub-groups tied to group chats.

---

## **Backend**

### **Database Migration** ✅
- [x] Add a `parent_group_id` column to the `groups` table to establish threads:
  ```sql
  ALTER TABLE groups
  ADD COLUMN parent_group_id UUID REFERENCES groups(id) ON DELETE CASCADE;
  ```

- [x] Update the database schema to ensure:
  - [x] Threads must have a `parent_group_id`.
  - [x] Groups cannot reference themselves as a parent:
    ```sql
    ALTER TABLE groups ADD CONSTRAINT check_not_self_parent CHECK (id <> parent_group_id);
    ```

- [x] Ensure only one level of nesting (threads cannot have threads as children):
  ```sql
  CREATE OR REPLACE FUNCTION enforce_single_level_nesting()
  RETURNS TRIGGER AS $$
  BEGIN
    IF NEW.parent_group_id IS NOT NULL THEN
      PERFORM 1 FROM groups WHERE id = NEW.parent_group_id AND parent_group_id IS NOT NULL;
      IF FOUND THEN
        RAISE EXCEPTION 'Threads cannot have threads as parents';
      END IF;
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER enforce_thread_nesting
  BEFORE INSERT OR UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION enforce_single_level_nesting();
  ```

### **API Endpoints** ✅
- [x] **POST `/api/groups/[id]/threads`**:
  - [x] Request body: `{ name: string }`
  - [x] Validates:
    - [x] Parent group exists and the user is a member.
    - [x] The thread name is unique within the parent group.
  - [x] Creates a thread by setting `parent_group_id` to the parent group ID.
  - [x] Returns thread details (e.g., `id`, `name`).

- [x] **GET `/api/groups/[id]/threads`**:
  - [x] Fetches all threads belonging to a parent group.
  - [x] Validates the user's membership in the parent group.
  - [x] Returns a list of threads.

- [x] **POST `/api/threads/[id]/messages`**:
  - [x] Allows users to send messages within a thread.
  - [x] Request body: `{ content: string }`.
  - [x] Validates that the user is a member of the thread.
  - [x] Creates a new message associated with the thread.

- [x] **GET `/api/threads/[id]/messages`**:
  - [x] Fetches messages for a specific thread.
  - [x] Validates user membership in the thread.
  - [x] Returns messages with sender details.
  - [x] Limits to last 50 messages.

---

## **Frontend**

### **UI Components**
- [x] **Group List**:
  - [x] Add a collapsible list of threads under each group in the group list.
  - [x] Display threads only if the user has joined them.
  - [x] Style threads differently from groups (indented).

- [x] **Create Thread Button**:
  - [x] Add a button next to each group in the group list to create a thread.
  - [x] Input field for entering the thread name.

- [ ] **Thread Messages UI**:
  - [ ] Create ChatThread component for thread-specific messages
  - [ ] Add visual distinction between thread and group messages
  - [ ] Show thread context (parent group name, thread name)
  - [ ] Add thread-specific message input
  - [ ] Display system messages about thread creation

### **Features**
- [x] **Create Thread**:
  - [x] Validate the thread name before submission.
  - [x] Show loading state during creation.
  - [x] Auto-expand thread list on creation.

- [x] **View Threads**:
  - [x] Display joined threads under their parent group.
  - [x] Show message count for each thread.

- [ ] **Send Messages in Threads**:
  - [ ] Allow users to send messages within a thread chat area.
  - [ ] Update the message list during polling.

### **State Management**
- [ ] Maintain a list of threads for each group the user is a member of.
- [ ] Update the thread list dynamically when a new thread is created.
- [ ] Track the active thread or group to update the chat UI.

### **Validation and Restrictions**
- [ ] Prevent creating threads for groups the user is not a member of.
- [ ] Restrict access to threads unless the user has joined them.
- [ ] Ensure threads cannot reference other threads as parents.

### **Accessibility**
- [ ] Ensure keyboard navigation supports opening threads and creating new ones.
- [ ] Add ARIA labels for thread-related UI elements.

---

## **Quality Assurance Checklist**

### **Functional Tests**
- [ ] Users can create threads under a group.
- [ ] Threads appear in the list only for users who have joined them.
- [ ] Users can send messages in threads and view them in real time.
- [ ] Creating a thread posts a notification message in the parent group.

### **Edge Cases**
- [ ] Prevent duplicate thread names within the same group.
- [ ] Validate that threads cannot have threads as parents.
- [ ] Ensure deleted threads are removed from the UI and database.

### **API Documentation**
- [x] Document thread endpoints
- [x] Document thread validation rules
- [x] Document thread error responses

### **UI/UX Tests**
- [ ] Thread UI is visually distinct and intuitive to use.
- [ ] Creating and switching between threads feels seamless.
- [ ] Feedback for thread creation and errors is clear.

---

This updated checklist reflects completed items and adds more detailed tasks for remaining work, particularly around the thread-specific chat UI, notifications, and testing.
