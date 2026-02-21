# Quick Start Guide - Mind Map Feature

## Step 1: Find Your Book ID and User ID

```sql
-- Find your book ID
SELECT id, title FROM books ORDER BY created_at DESC LIMIT 10;

-- Find your user ID
SELECT id, email FROM auth.users WHERE email = 'your_email@example.com';
```

## Step 2: Update the SQL Script

Open `scripts/insert-sample-mindmap-data.sql` and replace:
- Line 13: `63` with your book ID
- Line 14: `'00000000-0000-0000-0000-000000000000'` with your user ID

## Step 3: Run the SQL

Execute the updated SQL in Supabase SQL Editor.

## Step 4: Test the Mind Map

1. Navigate to your book in the application
2. Switch to Modern Reader theme (Layout icon in top-right)
3. Click the "脑图" (Mind Map) tab in the right sidebar
4. You should see the hierarchical mind map visualization!

## Troubleshooting

**Issue: "Column does not exist" error**
- Make sure you're using the correct table schema
- The table should have `summary`, `content_analysis`, and `mind_map_data` columns

**Issue: Mind map not showing**
- Check if data was inserted: `SELECT * FROM ai_book_analysis WHERE book_id = YOUR_BOOK_ID;`
- Verify you're in Modern Reader theme
- Check browser console for errors

**Issue: "No mind map data" message**
- The book doesn't have AI analysis yet
- Run the insert SQL script for that book
- Refresh the page

## Sample Data Structure

The mind map works with this JSON structure in `mind_map_data`:

```json
{
  "chapters": [
    {
      "title": "Chapter Title",
      "sections": ["Section 1", "Section 2"],
      "key_points": ["Point 1", "Point 2"]
    }
  ]
}
```

## Next Steps

- Generate real AI analysis for your books using OpenAI API
- Customize the mind map colors and layout
- Export mind maps as images
- Share mind maps with other users
