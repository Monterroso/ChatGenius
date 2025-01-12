# Hooks Documentation

This document outlines the custom React hooks used in the application for managing state, data fetching, polling, and responsiveness.

## 1. useIsMobile
Determines whether the current viewport width is below a specified mobile breakpoint.

• Implementation Details:  
  - The hook sets up a matchMedia listener to detect screen width changes.  
  - It returns a boolean indicating if the width is mobile-sized or not.  
  - Internally uses useState and useEffect to manage responsive state.

• Data Structures:  
  - Boolean state: isMobile

• Input Parameters:  
  - None

• Returns:  
  - isMobile: boolean | undefined

Example Use:  
--------------------------------------------------------------------------------
function MyComponent() {  
  const isMobile = useIsMobile();  
  return (  
    <div>  
      {isMobile ? "Mobile Layout" : "Desktop Layout"}  
    </div>  
  );  
}

--------------------------------------------------------------------------------

## 2. useToast
Provides a global toast notification system.

• Implementation Details:  
  - Maintains a list of active toasts in memory.  
  - Each toast has an id, title, description, and optional action.  
  - Functions exposed:  
    - toast(...) to create a new toast.  
    - dismiss(...) to remove an existing toast.  
  - Uses the React reducer pattern with dispatch, keeping track of toasts in an array.

• Data Structures:  
  - toasts: ToasterToast[] (array of toast objects)  
  - listeners: Array<(state: State) => void> (internal)  
  - memoryState: State (internal)

• Input Parameters:  
  - In toast(...) call, you can pass in toast properties such as title, description, action, and so on.

• Returns:  
  - toasts: ToasterToast[]  
  - toast: function to add a new toast  
  - dismiss: function to dismiss a toast by id  

Example Use:  
--------------------------------------------------------------------------------
function MyComponent() {  
  const { toasts, toast, dismiss } = useToast();

  const handleShowToast = () => {
    toast({ title: "Hello", description: "This is a toast." });
  };

  return (  
    <div className="flex flex-col gap-2">  
      <button
        type="button"
        className="px-4 py-2 bg-blue-500 text-white"
        onClick={handleShowToast}
      >
        Show Toast
      </button>  
      {toasts.map((t) => (
        <div key={t.id}>{t.title}</div>
      ))}  
    </div>  
  );  
}

--------------------------------------------------------------------------------

## 3. useMessagePolling
Handles polling for message updates in conversations.

• Implementation Details:  
  - Polls /api/messages with a query parameter indicating either groupId or userId.  
  - Default 3-second polling interval.  
  - Uses useEffect to handle starting and stopping of the polling.  
  - Exposes a refresh function to manually invoke the fetch.  

• Data Structures:  
  - messages: DBMessage[]  
  - error: Error | null  
  - isPolling: boolean  

• Input Parameters:  
  - selectedConversation: Conversation | null  
  - initialMessages?: DBMessage[] (default is [])  

• Returns:  
  - messages: DBMessage[]  
  - setMessages: React.Dispatch<React.SetStateAction<DBMessage[]>>  
  - isPolling: boolean  
  - error: Error | null  
  - refresh: () => Promise<void> (manually triggers a fetch)

Example Use:  
--------------------------------------------------------------------------------
function ChatRoom({ conversation, initialMsgs }: {
  conversation: Conversation | null;
  initialMsgs: DBMessage[];
}) {
  const {
    messages,
    isPolling,
    error,
    refresh
  } = useMessagePolling(conversation, initialMsgs);

  if (error) return <div>Error fetching messages!</div>;

  return (
    <div>
      <h2>Chat</h2>
      {messages.map((msg) => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      {isPolling && <p>Polling...</p>}
      <button type="button" onClick={refresh}>Refresh Messages</button>
    </div>
  );
}

--------------------------------------------------------------------------------

## 4. useMoodPolling
Handles polling for user mood updates.

• Implementation Details:  
  - Polls /api/mood/{userId} in parallel for each user ID.  
  - Default 3-second polling interval (configurable).  
  - Uses useEffect to manage the polling lifecycle.  
  - Catches individual request failures gracefully.

• Data Structures:  
  - moods: Map<string, UserMood>  
  - error: Error | null  
  - isPolling: boolean  

• Input Parameters:  
  - userIds: string[]  
  - interval?: number (defaults to 3000)  

• Returns:  
  - moods: Map<string, UserMood>  
  - error: Error | null  
  - isPolling: boolean  

Example Use:  
--------------------------------------------------------------------------------
function MoodDisplay({ userIds }: { userIds: string[] }) {
  const { moods, error, isPolling } = useMoodPolling(userIds);

  if (error) return <div>Error polling moods!</div>;

  return (
    <div>
      {userIds.map((id) => {
        const mood = moods.get(id) || { status: "unknown" };
        return <div key={id}>User {id} Mood: {mood.status}</div>;
      })}
      {isPolling && <p>Updating moods...</p>}
    </div>
  );
}

--------------------------------------------------------------------------------

## 5. useStatusPolling
Handles polling for user status updates.

• Implementation Details:  
  - Polls /api/status/{userId} in parallel for each user ID.  
  - Default 3-second polling interval (configurable).  
  - Uses useEffect for lifecycle management.  
  - Catches individual request failures gracefully.

• Data Structures:  
  - statuses: Map<string, EffectiveStatus>  
  - error: Error | null  
  - isPolling: boolean  

• Input Parameters:  
  - userIds: string[]  
  - interval?: number (defaults to 3000)

• Returns:  
  - statuses: Map<string, EffectiveStatus>  
  - error: Error | null  
  - isPolling: boolean  

Example Use:  
--------------------------------------------------------------------------------
function StatusDisplay({ userIds }: { userIds: string[] }) {
  const { statuses, error, isPolling } = useStatusPolling(userIds);

  if (error) return <div>Error polling statuses!</div>;

  return (
    <div>
      {userIds.map((id) => {
        const status = statuses.get(id) || { isOnline: false };
        return <div key={id}>User {id} Online? {status.isOnline ? "Yes" : "No"}</div>;
      })}
      {isPolling && <p>Updating statuses...</p>}
    </div>
  );
}

--------------------------------------------------------------------------------

## 6. useTemporaryState
Manages a temporary boolean state that automatically resets after a specified duration.

• Implementation Details:  
  - Uses a boolean useState to track current state.  
  - Uses a timeout to reset the state after the given duration.  
  - Returns a trigger function to set the state to true.

• Data Structures:  
  - state: boolean  

• Input Parameters:  
  - duration?: number (defaults to 2000ms)

• Returns:  
  - [boolean, () => void]  
    1. The current boolean state.  
    2. A function to activate the temporary state (which then resets).

Example Use:  
--------------------------------------------------------------------------------
function Notification() {
  const [isVisible, triggerVisibility] = useTemporaryState(3000);

  return (
    <div>
      <button
        type="button"
        onClick={triggerVisibility}
        className="px-4 py-2 bg-green-500 text-white"
      >
        Show Notification
      </button>
      {isVisible && <p>Action completed!</p>}
    </div>
  );
}

--------------------------------------------------------------------------------

