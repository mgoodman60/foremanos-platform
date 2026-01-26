import { processDocument } from './lib/document-processor.js';

async function main() {
  console.log('Processing Budget.pdf...');
  try {
    await processDocument('cmk5hyqms0005p2075yxs6opc');
    console.log('✅ Budget.pdf processed successfully');
  } catch (error: any) {
    console.error('❌ Error processing Budget.pdf:', error.message);
    console.error(error);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
