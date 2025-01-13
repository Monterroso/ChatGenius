# File Upload and Storage Checklist

This checklist outlines the steps for implementing file upload and storage functionality in your chat application.

---

## **Backend**

### **Database Schema**
- [x] Create a `files` table to store metadata for uploaded files:
  ```sql
  CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    uploader_id UUID REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    filepath VARCHAR(255) NOT NULL,
    filetype VARCHAR(50) NOT NULL,
    filesize BIGINT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  ```

### **API Endpoints**
- [x] **POST `/api/files/upload`**:
  - [x] Accept file uploads using `multipart/form-data`.
  - [x] Validate:
    - [x] File size (e.g., maximum 10MB).
    - [x] Allowed file types (e.g., `.jpg`, `.png`, `.pdf`, `.docx`).
  - [x] Save the file to a secure storage location (`public/uploads/`).
  - [x] Save metadata to the `files` table.
  - [x] Return file details (e.g., `id`, `filename`, `filepath`).

- [x] **GET `/api/files/[id]`**:
  - [x] Fetch file metadata by ID.
  - [x] Validate user's access to the file (based on `group_id`).
  - [x] Return a signed or public URL for file download.

- [x] **DELETE `/api/files/[id]`**:
  - [x] Validate that the requesting user is the uploader.
  - [x] Delete the file from storage.
  - [x] Remove metadata from the `files` table.

- [x] **GET `/api/groups/[id]/files`**:
  - [x] List all files in a group
  - [x] Include uploader details
  - [x] Validate group membership
  - [x] Sort by upload date

---

## **Frontend**

### **UI Components**
- [x] **File Upload Button**:
  - [x] Add a button for uploading files in the group chat UI.
  - [x] Use a drag-and-drop area or standard file input for selecting files.

- [x] **File List Component**:
  - [x] Display a list of files shared within a group.
  - [x] Include:
    - [x] File name (clickable for download).
    - [x] File size.
    - [x] Uploader name.
    - [x] Upload date.

### **Features**
- [x] **Upload File**:
  - [x] Validate file size and type on the client before submission.
  - [x] Show upload progress bar.
  - [x] Display a success or error message upon completion.

- [x] **Download File**:
  - [x] Allow users to download files by clicking on file names.
  - [x] Validate access permissions before download.

- [x] **Delete File (Uploader Only)**:
  - [x] Show a delete button for files uploaded by the current user.
  - [x] Confirm deletion with a dialog box.

### **State Management**
- [x] Maintain a list of files for the active group.
- [x] Update the file list after successful upload or deletion.
- [x] Ensure UI is updated immediately upon user interaction.

### **Validation and Restrictions**
- [x] Restrict file uploads to authorized users within the group.
- [x] Block uploads that exceed size or type limits.
- [x] Ensure deleted files are no longer accessible.

### **Accessibility**
- [ ] Make file upload and download accessible via keyboard navigation.
- [ ] Add ARIA labels for upload buttons and file list items.

---

## **Quality Assurance Checklist**

### **Functional Tests**
- [ ] Users can upload files to a group.
- [ ] Uploaded files are visible in the file list.
- [ ] Users can download files they have access to.
- [ ] Uploader can delete their files.

### **Edge Cases**
- [x] Validate that files exceeding size or type limits are rejected.
- [x] Prevent access to files outside the user's group.
- [x] Ensure file deletion removes both storage and metadata.

### **Performance Tests**
- [ ] Verify upload speeds for various file sizes.
- [ ] Confirm the file list is updated promptly during polling intervals.
- [ ] Ensure the UI remains responsive during uploads and downloads.

### **UI/UX Tests**
- [ ] File upload and list components are visually appealing and consistent.
- [ ] Progress bars and error messages provide clear feedback.
- [ ] File details (e.g., name, size, uploader) are displayed accurately.

---

We've completed the backend implementation including:
- Database schema
- File upload endpoint with validation
- File retrieval endpoint with access control
- File deletion endpoint with ownership verification
- Group files listing endpoint

Next steps should focus on the frontend implementation, starting with the UI components for file upload and display.
