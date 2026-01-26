#!/usr/bin/env python3
import os, sys, json, base64, requests, subprocess, time
from pathlib import Path
from dotenv import load_dotenv
load_dotenv('../.env')

print("🧪 Testing Claude Haiku OCR Pipeline\n")

# Test 1: Check environment
api_key = os.getenv('ABACUSAI_API_KEY')
print(f"✅ API Key: {api_key[:20]}...")

# Test 2: Convert one PDF page
pdf_path = '../public/regulatory-documents/IBC_2021.pdf'
print(f"\n📄 Converting page 150 from IBC...")

temp_dir = '/tmp/test_haiku'
Path(temp_dir).mkdir(parents=True, exist_ok=True)

cmd = ['pdftoppm', '-png', '-f', '150', '-l', '150', pdf_path, os.path.join(temp_dir, 'page')]
subprocess.run(cmd, check=True, capture_output=True)

image_files = [f for f in os.listdir(temp_dir) if f.endswith('.png')]
if not image_files:
    print("❌ No image generated")
    sys.exit(1)

image_path = os.path.join(temp_dir, image_files[0])
print(f"✅ Image generated: {image_path}")

# Test 3: OCR with Claude Haiku
print(f"\n🔤 Testing Claude Haiku OCR...")

with open(image_path, 'rb') as f:
    image_data = base64.b64encode(f.read()).decode('utf-8')

response = requests.post(
    'https://routellm.abacus.ai/v1/chat/completions',
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}'
    },
    json={
        'model': 'claude-3-5-haiku-20241022',
        'messages': [{
            'role': 'user',
            'content': [
                {'type': 'text', 'text': 'Extract all text from this page. Return only the text.'},
                {'type': 'image_url', 'image_url': {'url': f'data:image/png;base64,{image_data}'}}
            ]
        }],
        'max_tokens': 4096
    },
    timeout=60
)

if response.status_code == 200:
    data = response.json()
    text = data['choices'][0]['message']['content']
    print(f"✅ Claude Haiku OCR successful!")
    print(f"📝 Extracted {len(text)} characters")
    print(f"\nFirst 200 chars:\n{text[:200]}...")
else:
    print(f"❌ API Error: {response.status_code}")
    print(response.text[:500])

# Cleanup
import shutil
shutil.rmtree(temp_dir, ignore_errors=True)
print("\n✅ Test complete!")
