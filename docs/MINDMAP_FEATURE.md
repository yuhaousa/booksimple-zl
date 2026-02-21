# AI Mind Map Feature

## Overview
The AI Mind Map feature generates hierarchical visual mind maps based on the book's AI analysis data, similar to the style shown in the reference image with curved connections and clean node styling.

## Components

### BookMindMapAI Component
Located at: `components/book-mindmap-ai.tsx`

**Features:**
- Generates mind map structure from AI outline data
- Canvas-based rendering with smooth Bezier curves
- Interactive controls: zoom in/out, pan, reset view
- Download mind map as PNG image
- Supports multiple AI outline structures (chapters, topics, generic objects)
- Responsive to container size

**Props:**
```typescript
interface BookMindMapAIProps {
  bookTitle: string      // Book title for the root node
  aiOutline: any        // AI outline data (JSON structure)
  aiGuide?: string      // Optional AI reading guide
}
```

## Integration in Modern Book Reader

The mind map is integrated into the modern book reader's right sidebar under the "脑图" (Mind Map) tab:

**Tab Mapping:**
- 导读 (Guide) → `activeRightTab === 'guide'`
- 翻译 (Highlights) → `activeRightTab === 'highlights'`
- 脑图 (Mind Map) → `activeRightTab === 'notes'`
- 笔记 (Notes) → `activeRightTab === 'outline'`

## Database Schema

The mind map reads from the `ai_book_analysis` table with these columns:
- `summary` (TEXT) - Used as the AI reading guide (导读)
- `content_analysis` (JSONB) - Detailed analysis data
- `mind_map_data` (JSONB) - Mind map structure data (preferred for mind map)

The component prioritizes `mind_map_data` over `content_analysis` for rendering.

## AI Outline Data Structure

The mind map component supports multiple data structures:

### Structure 1: Chapters-based
```json
{
  "chapters": [
    {
      "title": "Chapter Title",
      "sections": ["Section 1", "Section 2"],
      "key_points": ["Point 1", "Point 2"]
    }
  ],
  "key_concepts": ["Concept 1", "Concept 2"]
}
```

### Structure 2: Topics-based
```json
{
  "main_topics": [
    {
      "name": "Topic Name",
      "subtopics": ["Subtopic 1", "Subtopic 2"]
    }
  ],
  "key_concepts": ["Concept 1", "Concept 2"]
}
```

### Structure 3: Generic Object
```json
{
  "section_name": ["Item 1", "Item 2"],
  "another_section": ["Item A", "Item B"]
}
```

## Mind Map Visualization

**Node Hierarchy:**
- Level 0 (Root): Book title - displayed with white background and blue border
- Level 1 (Main branches): Chapters/Topics - blue color (#3b82f6)
- Level 2 (Sub-branches): Sections/Subtopics - indigo color (#6366f1)
- Level 3+ (Details): Further nested items - purple shades

**Connections:**
- Smooth Bezier curves connecting parent to child nodes
- Junction circles at connection points
- Color-coded by hierarchy level

**Controls:**
- Zoom In/Out buttons
- Reset view button (resets zoom and position)
- Download button (exports as PNG)
- Click and drag to pan around the mind map

## Usage

### 1. Ensure AI Analysis Data Exists

The mind map requires data in the `ai_book_analysis` table:

```sql
-- Check if AI analysis exists for a book
SELECT * FROM ai_book_analysis 
WHERE book_id = YOUR_BOOK_ID;
```

### 2. Insert Sample Data (for Testing)

Use the provided SQL script:
```bash
# Edit the script to set your book_id and user_id
# Then execute in Supabase SQL Editor
scripts/insert-sample-mindmap-data.sql
```

### 3. Access in Reader

1. Open a book in the Modern Reader theme
2. Click the "脑图" (Mind Map) tab on the right sidebar
3. The mind map will automatically generate if AI outline data exists

## Styling

The mind map adapts to the reader's theme:
- Light mode: Dark text on white canvas
- Dark mode: Light text on dark canvas  
- Sepia mode: Sepia-toned styling

## Performance Considerations

- Canvas rendering for smooth performance
- Dynamic imports to reduce initial bundle size
- Efficient node position calculations
- Responsive to window resize events

## Future Enhancements

Potential improvements:
1. Click nodes to navigate to specific book pages
2. Expand/collapse branches for large mind maps
3. Different layout algorithms (radial, tree, force-directed)
4. Export to other formats (SVG, PDF)
5. Collaborative annotations on mind map nodes
6. AI-generated connections between related concepts
7. Search and highlight nodes
8. Custom color schemes

## Troubleshooting

**Mind Map Not Showing:**
- Verify AI analysis data exists in database
- Check browser console for errors
- Ensure the book has valid ai_outline JSON

**Layout Issues:**
- Try the Reset button to restore default view
- Refresh the page if canvas appears blank
- Check browser compatibility (modern browsers required)

**Data Structure Errors:**
- Validate JSON structure in ai_outline column
- Ensure at least one valid data field exists
- Check for parse errors in browser console
