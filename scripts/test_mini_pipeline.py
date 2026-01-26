#!/usr/bin/env python3
from resume_regulatory_haiku import MiniProcessor
import os
from dotenv import load_dotenv

load_dotenv('../.env')

print("🧪 Testing GPT-4o Mini processing pipeline\n")

db_url = os.getenv('DATABASE_URL')
api_key = os.getenv('ABACUSAI_API_KEY')

processor = MiniProcessor(db_url, api_key)
print("✅ Processor initialized")

# Test PDF to images
pdf_path = '../public/regulatory-documents/IBC_2021.pdf'
images = processor.pdf_to_images(pdf_path, '/tmp/test_mini_2', 150, 151)

if images:
    print(f"✅ Generated {len(images)} test images")
    
    # Test OCR
    text = processor.ocr_with_mini(images[0], 150)
    if text:
        print(f"✅ OCR successful: {len(text)} characters")
        print(f"\nSample: {text[:200]}...")
        
        # Test chunking
        chunks = processor.chunk_text(text)
        print(f"✅ Chunking successful: {len(chunks)} chunks")
        
        print("\n✅ Full pipeline works! Ready for bulk processing.")
    else:
        print("❌ OCR failed")
else:
    print("❌ Image generation failed")

import shutil
shutil.rmtree('/tmp/test_mini_2', ignore_errors=True)
