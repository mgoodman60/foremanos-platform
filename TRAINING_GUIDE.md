# 🎓 Chatbot Response Training Guide

## Overview
This guide explains how to "train" or improve the One Senior Care Construction ChatBot's responses. Since this uses a Large Language Model (LLM), traditional training isn't possible, but you can significantly improve responses through these methods.

---

## Method 1: System Prompt Engineering ⚡ (Fastest)

### What It Does
Controls how the AI interprets questions and formats answers.

### How to Modify
Edit `/app/api/chat/route.ts` around line 92:

```typescript
const contextPrompt = `You are an AI assistant for One Senior Care Construction Site ChatBot...
```

### Examples of Modifications

#### Add Project-Specific Context
```typescript
**Project Details:**
- Project: One Senior Care Facility Renovation
- Location: Morehead City, NC
- Project Manager: [Name]
- Start Date: [Date]
- Substantial Completion: [Date]
- Total Square Footage: [SF]
```

#### Add Response Style Guidelines
```typescript
**Tone Guidelines:**
- Always use construction industry terminology
- Be concise but thorough
- Assume user has basic construction knowledge
- Prioritize safety-related information
```

#### Add Custom Response Patterns
```typescript
**For RFI Questions:**
Always format as:
- RFI Number: [if applicable]
- Date: [from document]
- Response: [details]
- Reference: [sheet/page]

**For Schedule Questions:**
Always include:
- Activity name
- Start date
- Finish date
- Critical path indicator (if yes)
```

### When to Use
- Need to change response style/tone
- Want to add project context
- Need to enforce specific answer formats
- Want to add domain expertise

---

## Method 2: RAG Tuning 🎯 (Medium Difficulty)

### What It Does
Improves which document sections are retrieved for answering questions.

### How to Modify
Edit `/lib/rag.ts`:

#### Increase Number of Retrieved Chunks
```typescript
// In /app/api/chat/route.ts, line ~77
const { chunks, documentNames } = await retrieveRelevantDocuments(
  message || '', 
  userRole, 
  15  // Increase from 10 to retrieve more context
);
```

#### Add Custom Construction Phrases
```typescript
// In /lib/rag.ts, around line 169
const constructionPhrases = [
  { phrase: 'minimum depth', boost: 80 },
  { phrase: 'bottom of footing', boost: 80 },
  // ADD YOUR OWN:
  { phrase: 'shop drawing', boost: 70 },
  { phrase: 'submittal requirement', boost: 70 },
  { phrase: 'testing frequency', boost: 65 },
  { phrase: 'inspection required', boost: 65 },
];
```

#### Add Project-Specific Synonyms
```typescript
// In /lib/rag.ts, around line 94
const synonyms: Record<string, string[]> = {
  // Existing synonyms...
  
  // ADD YOUR OWN:
  'rfi': ['rfi', 'request for information', 'information request'],
  'submittals': ['submittal', 'submittals', 'shop drawing', 'product data'],
  'punchlist': ['punchlist', 'punch list', 'punch item', 'deficiency'],
};
```

#### Boost Specific Document Types
```typescript
// In /lib/rag.ts, around line 157
const isPlansDocument = documentName.toLowerCase().includes('plans.pdf');
if (isPlansDocument) {
  score += 60;
}

// ADD BOOSTS FOR OTHER DOCUMENTS:
const isSpecsDocument = documentName.toLowerCase().includes('spec');
if (isSpecsDocument) {
  score += 50;
}

const isSchedule = documentName.toLowerCase().includes('schedule');
if (isSchedule) {
  score += 45;
}
```

### When to Use
- Questions aren't finding the right documents
- Need to prioritize certain document types
- Have project-specific terminology
- Want better contextual understanding

---

## Method 3: Add Training Documents 📚 (Most Powerful)

### What It Does
Expands the knowledge base with additional construction documents.

### Step-by-Step Process

#### 1. Prepare Your Document
- **Supported formats**: PDF, DOCX
- **Recommended**: Use PDFs with searchable text (not scanned images)
- **Size**: No strict limit, but smaller chunks work better

#### 2. Upload Document
```bash
cp your-document.pdf /home/ubuntu/construction_project_assistant/nextjs_space/public/documents/
```

#### 3. Register in Database
Edit `/scripts/seed.ts` and add:

```typescript
await prisma.document.create({
  data: {
    name: 'Specifications.pdf',
    filePath: '/documents/Specifications.pdf',
    fileType: 'application/pdf',
    fileSize: 2500000, // Get actual size with `ls -l`
    accessLevel: 'internal', // or 'external' or 'both'
    processed: false,
  },
});
```

**Access Levels Explained:**
- `internal`: Only internal users can access
- `external`: Only external users can access  
- `both`: Everyone can access

#### 4. Process Document
```bash
cd /home/ubuntu/construction_project_assistant/nextjs_space
yarn tsx scripts/sync-and-process.ts
```

This will:
- Extract text from the PDF/DOCX
- Split into ~1000-character chunks
- Store in database with page numbers
- Make searchable by RAG system

#### 5. Verify Processing
```bash
yarn tsx --require dotenv/config << 'SCRIPT'
import { prisma } from './lib/db';

async function checkDoc() {
  const doc = await prisma.document.findFirst({
    where: { name: { contains: 'YourDocName' } },
    include: { _count: { select: { chunks: true } } }
  });
  console.log(`Document: ${doc?.name}`);
  console.log(`Processed: ${doc?.processed}`);
  console.log(`Chunks: ${doc?._count.chunks}`);
}

checkDoc().catch(console.error);
SCRIPT
```

### Recommended Documents to Add

**High Value:**
- Specifications (CSI format)
- RFI log with responses
- Submittal log
- Meeting minutes
- Change order log
- Daily reports
- Inspection reports

**Medium Value:**
- Safety plan
- Quality control plan
- Contract documents
- Product data sheets
- Warranty information

### When to Use
- Need answers from new document types
- Have project-specific documentation
- Want to reference meeting decisions
- Need historical project data

---

## Method 4: Use Feedback System 📊 (Long-term)

### What It Does
Tracks which responses are helpful via thumbs up/down.

### How It Works
The chatbot already has a feedback system built in:
- Users can rate responses with 👍 or 👎
- Feedback is stored in the database
- You can analyze patterns to improve prompts

### Check Feedback Data
```bash
cd /home/ubuntu/construction_project_assistant/nextjs_space
yarn tsx --require dotenv/config << 'SCRIPT'
import { prisma } from './lib/db';

async function analyzeFeedback() {
  const feedback = await prisma.messageFeedback.findMany({
    include: {
      message: {
        select: { message: true, response: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  
  console.log('Recent Feedback:');
  feedback.forEach(f => {
    console.log(`\n${f.rating === 1 ? '👍' : '👎'} Rating: ${f.rating}`);
    console.log(`Question: ${f.message.message}`);
    console.log(`Response preview: ${f.message.response.substring(0, 100)}...`);
    if (f.comment) console.log(`Comment: ${f.comment}`);
  });
}

analyzeFeedback().catch(console.error);
SCRIPT
```

### Using Feedback to Improve

1. **Find common negative feedback patterns**
   - Are certain question types getting poor ratings?
   - Is the AI missing specific information?

2. **Adjust based on patterns**
   - If schedule questions get bad ratings → Add more schedule context to prompt
   - If measurements are wrong → Check RAG is retrieving Plans.pdf
   - If tone is wrong → Adjust system prompt

### When to Use
- After users have tested the system
- To identify weak areas
- To validate improvements
- For ongoing optimization

---

## Method 5: Adjust Response Length/Detail

### Modify Max Tokens
In `/app/api/chat/route.ts`, line ~171:

```typescript
body: JSON.stringify({
  model: 'gpt-4.1-mini',
  messages: [...],
  stream: true,
  max_tokens: 2000, // Adjust this
}),
```

**Token Guidelines:**
- `500-1000`: Short, concise answers
- `1000-2000`: Balanced (current setting)
- `2000-4000`: Detailed explanations

### Add Response Length Instructions
In system prompt:

```typescript
**Response Length Guidelines:**
- For simple factual questions: 1-2 sentences
- For technical specifications: Include all relevant details
- For process questions: Step-by-step with references
- For safety questions: Err on the side of completeness
```

---

## Quick Reference: Which Method to Use?

| Goal | Best Method | Difficulty | Impact |
|------|-------------|------------|--------|
| Change response style | System Prompt | Easy | Medium |
| Add project context | System Prompt | Easy | High |
| Improve document retrieval | RAG Tuning | Medium | High |
| Add new knowledge | Add Documents | Easy | Very High |
| Fix specific question types | System Prompt + RAG | Medium | High |
| Make responses longer/shorter | Max Tokens | Easy | Low |
| Understand user satisfaction | Feedback System | Easy | Medium |

---

## Testing Your Changes

After making changes:

1. **Restart the server**
   ```bash
   pkill node
   cd /home/ubuntu/construction_project_assistant/nextjs_space
   yarn dev
   ```

2. **Test with sample questions**
   - Ask the same question before/after changes
   - Compare response quality
   - Check if citations are correct

3. **Monitor for issues**
   - Check browser console for errors
   - Verify documents are being retrieved
   - Ensure citations are accurate

---

## Common Issues & Solutions

### Problem: Responses are too generic
**Solution:** Add more project-specific context to system prompt

### Problem: Wrong document sections retrieved
**Solution:** Adjust RAG scoring, add relevant phrases/synonyms

### Problem: Missing information
**Solution:** Add the source document to the knowledge base

### Problem: Responses lack detail
**Solution:** Increase max_tokens, add detail requirements to prompt

### Problem: Citations are wrong
**Solution:** Check document processing, verify page numbers in chunks

---

## Need Help?

All configuration files are in:
- System Prompt: `/app/api/chat/route.ts`
- RAG System: `/lib/rag.ts`
- Document Processing: `/scripts/sync-and-process.ts`
- Database Schema: `/prisma/schema.prisma`

Remember: Changes to system prompt take effect immediately after server restart. Document changes require reprocessing.
