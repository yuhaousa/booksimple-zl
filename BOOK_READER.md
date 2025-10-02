# Book Reader Feature Documentation

## Overview

The Book Reader is a comprehensive PDF viewing component with advanced features for reading, annotating, and note-taking. It provides an immersive reading experience with:

- PDF viewing with zoom controls
- Document outline/table of contents navigation
- Text highlighting with color options
- Sticky notes functionality
- Sidebar navigation with organized sections
- Page navigation with keyboard shortcuts
- Responsive design for all devices

## Features

### 1. PDF Viewing
- **High-quality rendering** using PDF.js
- **Zoom controls** (50% to 300%)
- **Page navigation** with input field and arrow buttons
- **Keyboard shortcuts** for navigation

### 2. Document Outline
- **Automatic extraction** of PDF table of contents
- **Click to navigate** to specific sections
- **Hierarchical display** of document structure

### 3. Text Highlighting
- **Multiple color options** (Yellow, Blue, Green, Pink, Purple)
- **Text selection highlighting** with mouse
- **Persistent storage** in database
- **Highlight management** with delete functionality

### 4. Note Taking
- **Click-to-add notes** anywhere on the page
- **Inline editing** with rich text support
- **Visual note indicators** on pages
- **Note management** with edit/delete options

### 5. Sidebar Navigation
- **Tabbed interface** (Outline, Highlights, Notes)
- **Collapsible sidebar** for more reading space
- **Quick navigation** to highlighted text or notes
- **Search functionality** (coming soon)

## Database Schema

### Book Highlights Table
```sql
CREATE TABLE book_highlights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id INTEGER NOT NULL,
  page_number INTEGER NOT NULL,
  text TEXT NOT NULL,
  color VARCHAR(7) NOT NULL,
  position JSONB NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Book Notes Table
```sql
CREATE TABLE book_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id INTEGER NOT NULL,
  page_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  position JSONB NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Setup Instructions

### 1. Database Setup
1. Run the SQL script to create the required tables:
   ```bash
   psql -f scripts/create-book-reader-tables.sql
   ```

2. Or execute the SQL manually in your Supabase SQL editor

### 2. Dependencies Installation
The following dependencies are required:
```bash
npm install react-pdf pdfjs-dist
```

### 3. Component Integration
The book reader is automatically integrated into the book detail pages. For PDF files, an "Open Reader" button will appear alongside the existing "Read Book" button.

### 4. File Structure
```
components/
├── book-reader.tsx          # Main reader component
├── ui/
│   └── scroll-area.tsx      # Scrolling component

app/
└── books/
    └── [id]/
        └── reader/
            └── page.tsx     # Reader page

scripts/
└── create-book-reader-tables.sql  # Database setup
```

## Usage

### For Readers
1. **Opening a Book**: Click "Open Reader" on any book detail page (PDF files only)
2. **Navigation**: Use page controls, outline, or keyboard shortcuts
3. **Highlighting**: Toggle highlight mode, select text, choose color
4. **Note Taking**: Toggle note mode, click anywhere to add a note
5. **Managing Content**: Use sidebar to view, edit, or delete highlights and notes

### For Developers
1. **Customization**: Modify highlight colors in the `HIGHLIGHT_COLORS` array
2. **Styling**: Customize appearance through Tailwind classes
3. **Features**: Extend functionality by adding new sidebar tabs
4. **Integration**: Use the `<BookReader>` component in other parts of the app

## Technical Details

### PDF.js Integration
- Uses unpkg CDN for PDF.js worker
- Handles text layer and annotation layer rendering
- Supports both text selection and click events

### State Management
- React hooks for component state
- Supabase for persistent data storage
- Real-time updates for multi-user scenarios

### Performance Optimization
- Lazy loading of PDF pages
- Efficient re-rendering with React.memo
- Optimized database queries with indexes

### Security
- Row Level Security (RLS) policies
- User-specific data isolation
- Secure file URL generation with Supabase

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ← / → | Previous/Next page |
| + / - | Zoom in/out |
| Esc | Exit highlight/note mode |
| Ctrl + F | Search (coming soon) |

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support with minor CSS differences
- **Mobile browsers**: Responsive design with touch support

## Future Enhancements

1. **Search functionality** within PDF content
2. **Export highlights and notes** to various formats
3. **Collaborative reading** with shared annotations
4. **Reading progress tracking** and statistics
5. **Dark mode** optimization for better reading experience
6. **Bookmarks** for quick page access
7. **Text-to-speech** integration
8. **Multiple document comparison** view

## Troubleshooting

### Common Issues

1. **PDF not loading**: Check file URL and network connectivity
2. **Highlights not saving**: Verify user authentication and database permissions
3. **Performance issues**: Consider reducing PDF file size or implementing page caching
4. **Mobile rendering**: Ensure viewport meta tag is properly configured

### Error Handling
- Graceful fallbacks for PDF loading errors
- User-friendly error messages
- Automatic retry mechanisms for network issues

## API Reference

### BookReader Component Props
```typescript
interface BookReaderProps {
  book: {
    id: number
    title: string
    author: string | null
    file_url: string | null
    // ... other book properties
  }
}
```

### Database Operations
- **Highlights**: Create, read, update, delete with user isolation
- **Notes**: Full CRUD operations with rich text support
- **Books**: Read-only access for PDF rendering

## Security Considerations

1. **File Access**: Secure signed URLs for PDF files
2. **User Data**: RLS policies prevent cross-user data access
3. **Input Validation**: All user inputs are sanitized
4. **CORS**: Proper configuration for PDF.js worker

This book reader provides a professional-grade reading experience comparable to dedicated PDF applications while being fully integrated into your book management system.