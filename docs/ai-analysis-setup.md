# AI-Powered Book Analysis Setup

This document explains how to set up and use the AI-powered book analysis features in the Book Reader application.

## Overview

The AI analysis system uses OpenAI's GPT-4 to provide:
- **Intelligent Summaries**: Contextual book summaries based on actual content
- **Key Points Extraction**: Important takeaways and insights
- **Keyword Analysis**: Relevant terms and concepts
- **Topic Categorization**: Main subject areas covered
- **Difficulty Assessment**: Beginner/Intermediate/Advanced rating
- **Interactive Mind Maps**: Visual knowledge structure representation

## Setup Instructions

### 1. Get OpenAI API Key

1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign up or log in to your account
3. Create a new API key
4. Copy the key for configuration

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Add your OpenAI API key to `.env.local`:
   ```bash
   OPENAI_API_KEY=sk-your_actual_openai_api_key_here
   ```

### 3. Install Dependencies

The required dependencies should already be installed, but if needed:
```bash
npm install openai react-d3-tree @types/d3
```

### 4. Restart Development Server

After adding environment variables:
```bash
npm run dev
```

## How It Works

### AI Analysis Pipeline

1. **Content Preparation**: Book metadata (title, author, description, tags) is gathered
2. **PDF Text Extraction**: If available, text content is extracted from the PDF file
3. **AI Processing**: Content is sent to OpenAI GPT-4 for analysis
4. **Response Parsing**: AI response is parsed and structured
5. **Fallback Handling**: If AI fails, a fallback analysis is generated

### Features

#### Book Preview Page
- Navigate to any book and click "Book Preview"
- AI analysis runs automatically in the background
- Shows loading states and AI status indicators
- Provides retry option if AI analysis fails

#### Mind Map Generation
- AI creates hierarchical knowledge structures
- Interactive navigation with zoom and pan
- Expandable/collapsible nodes
- Visual representation of book concepts

## API Endpoints

### AI Analysis Endpoint
```
POST /api/books/[id]/ai-analysis
```

**Response Format:**
```json
{
  "success": true,
  "analysis": {
    "summary": "Book summary...",
    "keyPoints": ["Point 1", "Point 2", ...],
    "keywords": ["keyword1", "keyword2", ...],
    "topics": ["Topic 1", "Topic 2", ...],
    "readingTime": 180,
    "difficulty": "Intermediate",
    "mindmapData": { ... },
    "confidence": 0.85
  },
  "bookInfo": {
    "title": "Book Title",
    "author": "Author Name",
    "cover_url": "..."
  }
}
```

## Configuration Options

### AI Model Selection
Currently uses `gpt-4-turbo-preview`. You can modify in `lib/ai-book-analysis.ts`:
```typescript
model: "gpt-4-turbo-preview" // or "gpt-3.5-turbo" for cost savings
```

### Analysis Parameters
Adjust in `lib/ai-book-analysis.ts`:
- `max_tokens`: Control response length (default: 2000)
- `temperature`: Control creativity (default: 0.3)
- Text chunk size for large books (default: 8000 chars)

### PDF Text Extraction
Current implementation is basic. For production, consider:
- **Server-side**: `pdf-parse`, `pdf2pic`
- **Client-side**: `PDF.js`
- **Cloud Services**: Adobe PDF Services, Google Document AI

## Error Handling

### Graceful Degradation
1. **AI Service Unavailable**: Falls back to template-based analysis
2. **API Key Missing**: Shows configuration error message
3. **PDF Extraction Fails**: Uses metadata-only analysis
4. **Rate Limits**: Implements retry logic with backoff

### Status Indicators
- ✨ **AI-Powered Analysis**: Successful AI analysis
- 🔄 **Analyzing with AI**: Analysis in progress
- ⚠️ **Using fallback analysis**: AI failed, using templates
- 🔴 **AI analysis unavailable**: Configuration issue

## Cost Considerations

### OpenAI API Costs
- **GPT-4 Turbo**: ~$0.01 per 1K tokens
- **Average book analysis**: ~2K tokens = $0.02
- **Monthly estimate**: 100 analyses = $2.00

### Optimization Strategies
1. **Cache Results**: Store analysis results in database
2. **Use GPT-3.5**: Lower cost alternative for basic analysis
3. **Batch Processing**: Analyze multiple books together
4. **Text Chunking**: Process only key excerpts from large books

## Advanced Features

### Caching Analysis Results
Add to database schema:
```sql
CREATE TABLE book_ai_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id INTEGER REFERENCES "Booklist"(id),
  analysis_data JSONB NOT NULL,
  model_version VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(book_id, model_version)
);
```

### Custom Analysis Prompts
Modify prompts in `lib/ai-book-analysis.ts` for:
- Domain-specific analysis (technical books, fiction, etc.)
- Language-specific processing
- Custom output formats

### Integration with PDF Reader
Future enhancement: Use highlights and notes to improve analysis:
```typescript
// Include user annotations in analysis
const userContext = {
  highlights: getUserHighlights(bookId),
  notes: getUserNotes(bookId),
  readingProgress: getReadingProgress(bookId)
}
```

## Troubleshooting

### Common Issues

1. **"AI analysis not configured"**
   - Check `OPENAI_API_KEY` in `.env.local`
   - Restart development server

2. **"Rate limit exceeded"**
   - OpenAI API has usage limits
   - Wait and retry, or upgrade API plan

3. **Analysis takes too long**
   - Large books may take 10-30 seconds
   - Consider implementing progress indicators

4. **Inconsistent analysis quality**
   - Adjust temperature parameter
   - Improve prompt specificity
   - Use GPT-4 instead of GPT-3.5

### Debug Mode
Enable detailed logging:
```typescript
// In lib/ai-book-analysis.ts
console.log('AI Analysis Debug:', {
  bookTitle: bookContent.title,
  contentLength: textContent.length,
  prompt: analysisPrompt,
  response: response
})
```

## Security Considerations

### API Key Protection
- Never commit API keys to version control
- Use environment variables only
- Rotate keys periodically
- Monitor API usage for anomalies

### Content Privacy
- Book content is sent to OpenAI servers
- Consider data privacy implications
- For sensitive documents, use local AI models

### Rate Limiting
Implement client-side rate limiting:
```typescript
// Add rate limiting to prevent abuse
const rateLimiter = new Map()
const MAX_REQUESTS_PER_HOUR = 10
```

## Future Enhancements

1. **Multi-language Support**: Detect and analyze books in different languages
2. **Genre-specific Analysis**: Customize analysis for fiction, technical, academic books
3. **Collaborative Features**: Allow users to improve AI-generated analysis
4. **Integration with External APIs**: Goodreads, Google Books for additional context
5. **Advanced PDF Processing**: OCR for scanned documents, image analysis
6. **Real-time Analysis**: Stream analysis results as they're generated

## Support

For issues or questions:
1. Check environment variables configuration
2. Verify OpenAI API key validity
3. Review console logs for error details
4. Test with fallback analysis to isolate AI issues