import { File, Trash2 } from 'lucide-react';
import type { FileData } from '@/types/db';

interface FileListProps {
  /** The files to display */
  files: FileData[];
  /** The ID of the current user, used to determine if they can delete files */
  currentUserId: string;
  /** Callback function called when a file is successfully deleted */
  onFileDeleted: (fileId: string) => void;
}

/**
 * FileList Component
 * 
 * Displays a list of files shared in a conversation, either in a group chat or direct message.
 * Allows file owners to delete their own files and all users to download files.
 * 
 * @component
 * @param {Object} props
 * @param {FileData[]} props.files - Array of files to display
 * @param {string} props.currentUserId - The ID of the current user
 * @param {Function} props.onFileDeleted - Callback function when a file is deleted
 * 
 * @example
 * ```tsx
 * <FileList
 *   files={filesArray}
 *   currentUserId="user-123"
 *   onFileDeleted={(fileId) => handleFileDeleted(fileId)}
 * />
 * ```
 */
export const FileList = ({ 
  files,
  currentUserId, 
  onFileDeleted
}: FileListProps) => {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDelete = async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        onFileDeleted(fileId);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div key={file.id} className="flex items-center justify-between p-2 bg-gray-100 rounded">
          <div className="flex items-center gap-2">
            <File className="w-4 h-4" />
            <div className="flex flex-col">
              <a 
                href={file.download_url}
                className="text-sm text-blue-600 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {file.filename}
              </a>
              <span className="text-xs text-gray-500">
                {formatFileSize(file.filesize)} • Uploaded by {file.uploader_username}
              </span>
            </div>
          </div>
          {currentUserId === file.uploader_id && (
            <button
              onClick={() => handleDelete(file.id)}
              className="p-1 hover:bg-gray-200 rounded"
              title="Delete file"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}; 