const mammoth = require('mammoth');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

async function convertDocxToPdf(docxBuffer) {
  try {
    // Extract text from DOCX
    const result = await mammoth.extractRawText({ buffer: docxBuffer });
    const text = result.value;

    // Create PDF
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 72, bottom: 72, left: 72, right: 72 }
    });

    const chunks = [];
    
    return new Promise((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.font('Helvetica').fontSize(12).text(text, { align: 'left', lineGap: 2 });
      doc.end();
    });
  } catch (error) {
    throw new Error('Failed to convert document: ' + error.message);
  }
}

async function main() {
  const docxFiles = [
    'Project Overview.docx',
    'Critical Path Plan.docx'
  ];
  
  for (const filename of docxFiles) {
    try {
      const docxPath = path.join(__dirname, '..', 'public', 'documents', filename);
      const pdfFilename = filename.replace(/\.docx$/i, '.pdf');
      const pdfPath = path.join(__dirname, '..', 'public', 'documents', pdfFilename);
      
      // Skip if PDF already exists
      if (fs.existsSync(pdfPath)) {
        console.log(`✓ ${pdfFilename} already exists, skipping`);
        continue;
      }
      
      if (!fs.existsSync(docxPath)) {
        console.log(`✗ ${filename} not found`);
        continue;
      }
      
      console.log(`Converting ${filename}...`);
      const docxBuffer = fs.readFileSync(docxPath);
      const pdfBuffer = await convertDocxToPdf(docxBuffer);
      fs.writeFileSync(pdfPath, pdfBuffer);
      console.log(`✓ Created ${pdfFilename} (${pdfBuffer.length} bytes)`);
    } catch (error) {
      console.error(`✗ Failed to convert ${filename}:`, error.message);
    }
  }
  
  console.log('\nConversion complete!');
}

main().catch(console.error);
