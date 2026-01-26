import mammoth from 'mammoth';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

export async function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  try {
    // Extract text and basic formatting from DOCX
    const result = await mammoth.extractRawText({ buffer: docxBuffer });
    const text = result.value;

    // Create a new PDF document
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: 72,
        bottom: 72,
        left: 72,
        right: 72
      }
    });

    // Collect PDF chunks
    const chunks: Buffer[] = [];
    
    // Convert stream to buffer
    await new Promise<void>((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve());
      doc.on('error', reject);

      // Add content to PDF
      doc
        .font('Helvetica')
        .fontSize(12)
        .text(text, {
          align: 'left',
          lineGap: 2
        });

      // Finalize the PDF
      doc.end();
    });

    return Buffer.concat(chunks);
  } catch (error) {
    console.error('Error converting DOCX to PDF:', error);
    throw new Error('Failed to convert document to PDF');
  }
}

export async function isConversionSupported(fileType: string): Promise<boolean> {
  const supportedTypes = ['docx', 'doc'];
  return supportedTypes.includes(fileType.toLowerCase());
}
