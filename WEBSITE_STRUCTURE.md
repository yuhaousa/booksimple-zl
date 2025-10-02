# BookSimple ZL - Website Structure Documentation

## Overview
This document outlines the complete web page structure of the BookSimple ZL application, a Next.js-based digital library management system with PDF reading capabilities.

## Application Architecture
- **Framework**: Next.js 15.2.4 with App Router
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS with Radix UI components
- **PDF Processing**: react-pdf with PDF.js

---

## Root Layout & Global Pages

### `/` - Homepage
- **File**: `app/page.tsx`
- **Purpose**: Landing page with application overview
- **Features**:
  - Banner carousel showcasing featured content
  - Statistics dashboard (total books, users)
  - Featured books section
  - Application features overview
  - Authentication status display
- **Components**: BannerCarousel, BookCard
- **Access**: Public

### `/login` - Authentication
- **File**: `app/login/page.tsx`
- **Purpose**: User login interface
- **Features**:
  - Email/password authentication
  - Password visibility toggle
  - User login tracking with SHA256 hashing
  - Redirect to dashboard after successful login
- **Access**: Public (redirects authenticated users)

### `/register` - User Registration
- **File**: `app/register/page.tsx`
- **Purpose**: New user account creation
- **Features**:
  - User registration form
  - Account verification workflow
  - Integration with Supabase Auth
- **Access**: Public

---

## Book Management Section

### `/books` - Book Library
- **File**: `app/books/page.tsx`
- **Purpose**: Main book browsing interface
- **Features**:
  - Paginated book grid (12 books per page)
  - Book search and filtering
  - Responsive book cards with cover images
  - Navigation controls (first, previous, next, last)
  - User-specific book access control
- **Components**: BookCard
- **Access**: Authenticated users

### `/books/[id]` - Book Details
- **File**: `app/books/[id]/page.tsx`
- **Purpose**: Individual book information and actions
- **Features**:
  - Book metadata display (title, author, description, year)
  - Cover image display with fallback
  - Action buttons (Read, Edit, Delete, Add to Reading List)
  - User ownership validation
  - Reading list management
- **Components**: BookActions
- **Access**: Authenticated users (owner for edit/delete)

### `/books/[id]/edit` - Book Editing
- **File**: `app/books/[id]/edit/page.tsx`
- **Purpose**: Edit book information
- **Features**:
  - Form for updating book metadata
  - Cover image upload/management
  - PDF file replacement
  - Form validation and error handling
- **Components**: EditBookForm
- **Access**: Book owner only

### `/books/[id]/preview` - Book Preview
- **File**: `app/books/[id]/preview/page.tsx`
- **Purpose**: Quick preview of book content
- **Features**:
  - Basic PDF viewer
  - Limited navigation
  - Lightweight alternative to full reader
- **Access**: Authenticated users

### `/books/[id]/reader` - PDF Reader
- **File**: `app/books/[id]/reader/page.tsx`
- **Purpose**: Full-featured PDF reading experience
- **Features**:
  - Advanced PDF viewer with react-pdf
  - Interactive outline/table of contents
  - Text highlighting system
  - Note-taking functionality
  - Reading mode options (light/dark/sepia)
  - Zoom controls and page navigation
  - Custom bookmark creation
  - AI-powered book analysis
  - Mind map generation
- **Components**: BookReader, BookMindmap
- **Access**: Authenticated users

---

## Content Management

### `/upload` - File Upload
- **File**: `app/upload/page.tsx`
- **Purpose**: Add new books to library
- **Features**:
  - PDF file upload with drag-and-drop
  - Automatic metadata extraction
  - Cover image upload
  - Form validation
  - Supabase storage integration
- **Components**: BookUploadForm
- **Access**: Authenticated users

### `/reading-list` - Reading List Management
- **File**: `app/reading-list/page.tsx`
- **Purpose**: Personal reading list organization
- **Features**:
  - User's curated book list
  - Reading status tracking (to-read, reading, completed)
  - Quick access to book reader
  - List management (add/remove books)
- **Access**: Authenticated users

---

## Notes System

### `/notes` - Notes Overview
- **File**: `app/notes/page.tsx`
- **Purpose**: Centralized notes management
- **Features**:
  - List of all user notes across books
  - Search and filtering capabilities
  - Quick navigation to specific notes
  - Note organization by book/date
- **Access**: Authenticated users

### `/notes/new` - Create Note
- **File**: `app/notes/new/page.tsx`
- **Purpose**: Create standalone notes
- **Features**:
  - Rich text note creation
  - Book association options
  - Tag management
  - Note categorization
- **Access**: Authenticated users

### `/notes/[id]` - View Note
- **File**: `app/notes/[id]/page.tsx`
- **Purpose**: Display individual note details
- **Features**:
  - Full note content display
  - Associated book information
  - Navigation to related content
  - Edit/delete actions
- **Access**: Note owner only

### `/notes/[id]/edit` - Edit Note
- **File**: `app/notes/[id]/edit/page.tsx`
- **Purpose**: Modify existing notes
- **Features**:
  - Rich text editor
  - Metadata editing
  - Version history (if implemented)
  - Save/cancel actions
- **Access**: Note owner only

---

## Administrative Interface

### `/admin` - Admin Dashboard
- **File**: `app/admin/page.tsx`
- **Layout**: `app/admin/layout.tsx`
- **Purpose**: Administrative overview and statistics
- **Features**:
  - User statistics and analytics
  - Daily login/registration charts
  - Book upload statistics
  - System health monitoring
  - Data visualization with Recharts
- **Components**: Custom charts and statistics displays
- **Access**: Admin users only

### `/admin/users` - User Management
- **File**: `app/admin/users/page.tsx`
- **Purpose**: Manage user accounts
- **Features**:
  - User list with search/filtering
  - Account status management
  - User role assignment
  - Account deletion/suspension
  - User activity monitoring
- **Access**: Admin users only

### `/admin/books` - Book Administration
- **File**: `app/admin/books/page.tsx`
- **Purpose**: System-wide book management
- **Features**:
  - All books overview
  - Content moderation
  - Bulk operations
  - Storage usage monitoring
  - Quality assurance tools
- **Access**: Admin users only

### `/admin/settings` - System Settings
- **File**: `app/admin/settings/page.tsx`
- **Purpose**: Application configuration
- **Features**:
  - System-wide settings management
  - Feature flag controls
  - Storage configuration
  - Security settings
  - Performance tuning options
- **Access**: Admin users only

---

## API Endpoints

### `/api/books/[id]/ai-analysis` - AI Book Analysis
- **File**: `app/api/books/[id]/ai-analysis/route.ts`
- **Purpose**: AI-powered book content analysis
- **Methods**: GET, POST
- **Features**:
  - Content analysis using OpenAI
  - Summary generation
  - Key themes extraction
  - Reading recommendations
  - Mind map data generation
- **Access**: Authenticated users (book access required)

---

## Shared Layouts

### Root Layout
- **File**: `app/layout.tsx`
- **Purpose**: Application-wide layout and providers
- **Features**:
  - Global navigation
  - Authentication context
  - Theme provider
  - Toast notifications
  - Global CSS imports

### Admin Layout
- **File**: `app/admin/layout.tsx`
- **Purpose**: Administrative section layout
- **Features**:
  - Admin navigation sidebar
  - Role-based access control
  - Admin-specific styling
  - Breadcrumb navigation

---

## Loading States

### Book Loading States
- **Files**: Various `loading.tsx` files in book routes
- **Purpose**: Provide loading UI during data fetching
- **Features**:
  - Skeleton loaders
  - Progress indicators
  - Smooth transitions

---

## Database Integration

### Tables Structure
The application uses the following main database tables:
- `Booklist` - Book metadata and file references
- `book_highlights` - PDF text highlights
- `book_notes` - User notes and annotations
- `custom_outline` - User-created bookmarks
- `reading_list_full` - User reading lists

### Authentication & Security
- Row Level Security (RLS) policies
- User-based data isolation
- Secure file upload to Supabase Storage
- Session management with Supabase Auth

---

## Key Components

### Core Components
- `BookReader` - Full-featured PDF reader
- `BookCard` - Book display component
- `BookUploadForm` - File upload interface
- `BookActions` - Book interaction controls
- `BannerCarousel` - Homepage carousel
- `Navigation` - Site-wide navigation

### UI Components
Located in `components/ui/`:
- Form controls (Button, Input, Textarea)
- Layout components (Card, ScrollArea)
- Navigation (DropdownMenu)
- Feedback (Toast, Badge)

---

## File Structure Summary

\`\`\`
app/
├── layout.tsx                 # Root layout
├── page.tsx                   # Homepage
├── login/page.tsx            # Authentication
├── register/page.tsx         # User registration
├── books/
│   ├── page.tsx              # Book library
│   └── [id]/
│       ├── page.tsx          # Book details
│       ├── edit/page.tsx     # Edit book
│       ├── preview/page.tsx  # Book preview
│       └── reader/page.tsx   # PDF reader
├── notes/
│   ├── page.tsx              # Notes list
│   ├── new/page.tsx          # Create note
│   └── [id]/
│       ├── page.tsx          # View note
│       └── edit/page.tsx     # Edit note
├── upload/page.tsx           # File upload
├── reading-list/page.tsx     # Reading list
├── admin/
│   ├── layout.tsx            # Admin layout
│   ├── page.tsx              # Admin dashboard
│   ├── users/page.tsx        # User management
│   ├── books/page.tsx        # Book administration
│   └── settings/page.tsx     # System settings
└── api/
    └── books/[id]/ai-analysis/route.ts  # AI analysis API
\`\`\`

This structure provides a comprehensive digital library platform with advanced PDF reading capabilities, user management, and administrative tools.
