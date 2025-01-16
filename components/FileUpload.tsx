import { Upload } from 'lucide-react';
import { useState } from 'react';

interface FileUploadProps {
  /**
   * Whether a file is currently being uploaded
   */
  isUploading: boolean;
  /**
   * The current upload progress (0-100)
   */
  uploadProgress: number;
  /**
   * Callback function that is called when a file is selected for upload
   */
  onFileSelect: (file: File) => void;
}

/**
 * FileUpload component that provides the UI for file uploads in chat conversations.
 * 
 * This component handles the file selection UI and delegates the actual upload
 * process to the parent component. It shows upload progress and handles the disabled
 * state during uploads.
 * 
 * @component
 * @example
 * ```tsx
 * <FileUpload 
 *   isUploading={isUploading}
 *   uploadProgress={progress}
 *   onFileSelect={handleFileSelect}
 * />
 * ```
 */
export const FileUpload = ({ 
  isUploading,
  uploadProgress,
  onFileSelect 
}: FileUploadProps) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className="relative">
      <input
        type="file"
        onChange={handleFileChange}
        className="hidden"
        id="file-upload"
        accept="image/jpeg,image/png,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        disabled={isUploading}
      />
      <label
        htmlFor="file-upload"
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer ${
          isUploading 
            ? 'bg-gray-300 text-gray-700' 
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        } transition-colors`}
        title="Upload file"
      >
        <Upload className="w-4 h-4" />
        <span className="hidden sm:inline">
          {isUploading ? 'Uploading...' : 'Upload'}
        </span>
      </label>
      {isUploading && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-200 rounded">
          <div 
            className="h-full bg-primary rounded transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}
    </div>
  );
}; 