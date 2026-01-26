# How to Add New Training Documents

## Step 1: Add Document File
Place your PDF or DOCX file in:
```
/public/documents/your-document.pdf
```

## Step 2: Update Seed Script
Edit `scripts/seed.ts` and add your document:

```typescript
await prisma.document.create({
  data: {
    name: 'Your Document Name.pdf',
    filePath: '/documents/your-document.pdf',
    fileType: 'application/pdf',
    fileSize: 1234567, // Size in bytes
    accessLevel: 'internal', // or 'external' or 'both'
    processed: false,
  },
});
```

## Step 3: Process Document
Run the processing script:
```bash
cd nextjs_space
yarn tsx scripts/sync-and-process.ts
```

This will:
- Extract text from the document
- Split into searchable chunks
- Store in database for RAG retrieval

## Step 4: Restart Server
```bash
pkill node
yarn dev
```

Your new document is now available for training!
