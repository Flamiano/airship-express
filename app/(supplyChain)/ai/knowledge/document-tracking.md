# Document Tracking & Logistics Records

## Overview

The Document Tracking & Logistics Records system is a comprehensive document management solution built for supply chain operations. It provides a centralized repository for managing, tracking, and auditing all document-related activities.

---

## Core Features

### 1. Document Management
- **Upload**: Multi-file upload with duplicate detection
- **Preview**: Inline preview for PDFs and images
- **Download**: Single and bulk download capabilities
- **Edit**: Update document metadata (title, category, supplier, etc.)
- **Delete**: Soft delete with archiving
- **Bulk Operations**: Select multiple documents for download or delete

### 2. Document Metadata
Each document stores:
- Document title and file name
- File size and type (MIME)
- Storage path in Supabase
- Category ('documents' or 'photos')
- Document type ('Official Receipt', 'Invoice', etc.)
- Supplier name and PO number
- Parcel batch number
- Uploader name and notes
- Version number
- Created and updated timestamps

### 3. Activity History
Tracks all user actions:
- Upload operations
- Document metadata updates
- Delete operations (single or bulk)

Each activity includes:
- User name and email
- Action type
- Target resource
- Document reference
- Timestamp
- Status
- Additional metadata

### 4. Archive System
- Deleted documents are moved to archive table
- Preserves all original metadata
- Tracks who deleted and when
- Supports restore functionality

### 5. Filtering & Search
- Search by title or file name
- Category filter (Photos, Documents, specific types)
- Supplier filter
- Date range filtering
- Document type quick filter buttons

### 6. Statistics Dashboard
Real-time statistics:
- Total Files
- Photos count
- Documents count
- Storage Used
- Categories count
- Archived count

---

## Architecture

### Database Tables

#### Documents Table
- Stores all active documents
- Includes metadata, file reference, and timestamps
- Version tracking for updates
- Created by user reference

#### Activity History Table
- Logs all user actions
- Tracks who performed what action
- Stores document reference and details
- Timestamp and status tracking

#### Archive Table
- Stores deleted documents
- Preserves original data
- Tracks deletion metadata
- Supports restore operations

---

## Data Flow

### Upload Flow
1. User selects files (multiple)
2. Duplicate check (file name + size)
3. Upload to Supabase Storage
4. Insert record into documents table
5. Log activity (upload)
6. Refresh document list

### Delete Flow
1. User confirms deletion
2. Log activity (delete)
3. Copy record to archive
4. Delete from storage
5. Delete from documents table
6. Update archive count
7. Refresh document list

### Update Flow
1. User modifies metadata
2. Validate inputs
3. Update documents table
4. Increment version
5. Log activity (update)
6. Refresh document list

---

## UI Components

### Statistics Cards
- Interactive flip cards
- Front: Icon, label, value
- Back: Detailed breakdown
- Tooltip on hover
- Badge for quick stats

### Category Bar
Quick filter buttons:
- All Files
- Photos
- Documents
- Document Types (Receipt, Invoice, etc.)

### Document Table
Features:
- Checkbox selection for bulk operations
- File type icon
- Document metadata display
- Action buttons (View, Edit, Download, Delete)
- Pagination controls

### Activity History Table
Features:
- User avatar with name
- Action type badges (color-coded)
- Document reference
- Timestamp
- Status indicator
- Bulk delete capability

### Modals
- **Upload Modal**: Drag & drop, metadata fields, progress bar
- **Preview Modal**: File preview (PDF, images), metadata display
- **Edit Modal**: Metadata editing with read-only file preview

---

## Security

### Authentication
- Uses Supabase Auth
- Falls back to default user if not authenticated
- User info displayed in header

### File Storage
- Supabase Storage bucket
- Public URL generation for downloads
- File size limit: 10MB per file

### Data Access
- Row Level Security (RLS) policies
- Activities logged for audit trail
- Deleted files archived before removal

---

## Performance Optimizations

### Debouncing
- Search input: 300ms delay
- Activity search: 300ms delay
- Prevents excessive API calls

### Pagination
- Documents: 10 items per page
- Activities: 5 items per page
- Reduces initial load time

### Caching
- Image cache for previews
- Supplier list cached

### Lazy Loading
- Images load lazily
- Infinite scroll for activity history

---

## Technical Stack

### Frontend
- Next.js (App Router)
- React with Tailwind CSS
- React hooks for state management
- Native HTML forms with FormData
- Font Awesome icons

### Backend
- Supabase (PostgreSQL)
- Supabase Storage
- Supabase Auth
- Supabase Realtime

### Utilities
- Sonner for toast notifications
- Custom useDebounce hook
- Custom useConfirm hook
- Skeleton Loader component

---

## Common Issues

### Upload Fails
- Check file size (max 10MB)
- Verify file type is supported
- Check Supabase storage permissions

### Preview Not Loading
- Verify file is uploaded to storage
- Check public URL generation
- Ensure proper file type

### Delete Fails
- Check archive table permissions
- Verify storage delete permissions
- Check RLS policies

### Activity Not Logged
- Verify user authentication
- Check activity_history table permissions
- Ensure proper action type

---

## Usage Guide

### Upload Documents
1. Click "Upload Files" button
2. Drag & drop or click to select files
3. Fill in metadata fields
4. Click "Upload Files" to submit

### Search & Filter
1. Use search bar for title/file name
2. Click category buttons to filter
3. Use dropdowns for type and supplier
4. Select date range for filtering

### Manage Documents
1. Click "View" to preview file
2. Click "Edit" to update metadata
3. Click "Download" to save file
4. Click "Delete" to archive document

### Bulk Operations
1. Select documents using checkboxes
2. Click "Download Selected" for multiple files
3. Click "Delete Selected" to archive multiple

### Activity History
1. View all user actions
2. Filter by action type
3. Search by user or document
4. Select and delete activities