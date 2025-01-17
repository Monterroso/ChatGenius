import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface FilePollingOptions {
  groupId?: string;
  receiverId?: string;
  enabled?: boolean;
  interval?: number;
}

interface FileData {
  id: string;
  filename: string;
  filepath: string;
  filetype: string;
  filesize: number;
  uploaded_at: string;
  uploader_id: string;
  uploader_username: string;
}

const DEFAULT_POLLING_INTERVAL = 3000; // fallback value

export function useFilePolling({
  groupId,
  receiverId,
  enabled = true,
  interval = Number(process.env.NEXT_PUBLIC_FILE_POLLING_INTERVAL) || DEFAULT_POLLING_INTERVAL
}: FilePollingOptions) {
  const { data: session } = useSession();
  const [files, setFiles] = useState<FileData[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (!enabled || (!groupId && !receiverId) || !session?.user?.id) {
      return;
    }

    let timeoutId: NodeJS.Timeout;
    let mounted = true;

    const pollFiles = async () => {
      try {
        setIsPolling(true);
        let url = '/api/files';
        
        if (groupId) {
          url = `/api/groups/${groupId}/files`;
        } else if (receiverId) {
          url = `/api/messages/${receiverId}/files`;
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch files');
        }

        const data = await response.json();

        if (mounted) {
          setFiles(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (mounted) {
          setIsPolling(false);
          timeoutId = setTimeout(pollFiles, interval);
        }
      }
    };

    timeoutId = setTimeout(pollFiles, interval);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [groupId, receiverId, enabled, interval, session?.user?.id]);

  return {
    files,
    error,
    isPolling,
    setFiles
  };
} 