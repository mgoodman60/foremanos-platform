#!/usr/bin/env python3
import os, base64, requests, subprocess
from pathlib import Path
from dotenv import load_dotenv
load_dotenv('../.env')

print("🧪 Testing GPT-4o Mini Vision for OCR\n")

api_key = os.getenv('ABACUSAI_API_KEY')

# Convert one page
pdf_path = '../public/regulatory-documents/IBC_2021.pdf'
temp_dir = '/tmp/test_mini'
Path(temp_dir).mkdir(parents=True, exist_ok=True)

cmd = ['pdftoppm', '-png', '-f', '150', '-l', '150', pdf_path, os.path.join(temp_dir, 'page')]
subprocess.run(cmd, check=True, capture_output=True)

image_files = [f for f in os.listdir(temp_dir) if f.endswith('.png')]
image_path = os.path.join(temp_dir, image_files[0])

print(f"✅ Image generated")

# Test GPT-4o Mini with vision
with open(image_path, 'rb') as f:
    image_data = base64.b64encode(f.read()).decode('utf-8')

response = requests.post(
    'https://routellm.abacus.ai/v1/chat/completions',
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}'
    },
    json={
        'model': 'gpt-4o-mini',
        'messages': [{
            'role': 'user',
            'content': [
                {'type': 'text', 'text': 'Extract all text from this building code page.'},
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
    print(f"✅ GPT-4o Mini Vision works!")
    print(f"📝 Extracted {len(text)} characters")
    print(f"\nSample:\n{text[:300]}...")
    print(f"\n💰 Cost estimate: ~$0.002-0.003 per page (70-80% cheaper than GPT-4o)")
else:
    print(f"❌ Error: {response.status_code}")
    print(response.text)

import shutil
shutil.rmtree(temp_dir, ignore_errors=True)
