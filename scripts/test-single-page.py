#!/usr/bin/env python3
"""Test single page processing to diagnose timeout"""

import os, sys, base64, requests, subprocess, time
from pathlib import Path
from dotenv import load_dotenv

load_dotenv('../.env')

api_key = os.getenv('ABACUSAI_API_KEY')
pdf_path = '../public/regulatory-documents/IBC_2021.pdf'
page_num = 280
temp_dir = '/tmp/test_page_280'

print(f"🧪 Testing page {page_num} processing...\n")

# Convert page to image
Path(temp_dir).mkdir(parents=True, exist_ok=True)
print("1️⃣ Converting PDF to image...")
start = time.time()
subprocess.run(['pdftoppm', '-png', '-f', str(page_num), '-l', str(page_num), pdf_path, os.path.join(temp_dir, 'page')], check=True, capture_output=True)
print(f"   ✅ Converted in {time.time()-start:.1f}s")

# Get image
img_file = [f for f in os.listdir(temp_dir) if f.endswith('.png')][0]
img_path = os.path.join(temp_dir, img_file)

with open(img_path, 'rb') as f:
    image_data = base64.b64encode(f.read()).decode('utf-8')

print(f"\n2️⃣ Calling GPT-4o Mini API...")
print(f"   Image size: {len(image_data)} bytes")
print(f"   Timeout: 60 seconds")

start = time.time()
try:
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
                    {'type': 'text', 'text': 'Extract all text from this regulatory document page.'},
                    {'type': 'image_url', 'image_url': {'url': f'data:image/png;base64,{image_data}'}}
                ]
            }],
            'max_tokens': 4096
        },
        timeout=60
    )
    
    elapsed = time.time() - start
    print(f"   ✅ API responded in {elapsed:.1f}s")
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        text = response.json()['choices'][0]['message']['content']
        print(f"   Text length: {len(text)} chars")
        print(f"\n3️⃣ First 200 chars:")
        print(f"   {text[:200]}")
    else:
        print(f"   ❌ Error: {response.text[:500]}")
        
except requests.Timeout:
    elapsed = time.time() - start
    print(f"   ❌ TIMEOUT after {elapsed:.1f}s")
    print("   This is the problem! API calls are timing out.")
except Exception as e:
    elapsed = time.time() - start
    print(f"   ❌ Error after {elapsed:.1f}s: {e}")

# Cleanup
import shutil
shutil.rmtree(temp_dir, ignore_errors=True)

print("\n" + "="*60)
print("DIAGNOSIS:")
print("="*60)
print("If you see TIMEOUT above, that's why processing stops.")
print("Solution: Increase timeout or implement retry logic.")
