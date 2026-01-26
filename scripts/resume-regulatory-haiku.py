#!/usr/bin/env python3
"""
Resume Regulatory Document Processing with Claude 3.5 Haiku
Resumes IBC and NFPA processing at 90% cost savings
"""

import os
import sys
import json
import base64
import requests
import subprocess
import time
import random
from pathlib import Path
from typing import List
import psycopg2
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = os.path.join(os.path.dirname(__file__), '../.env')
load_dotenv(env_path)

# Configuration
CHUNK_SIZE = 2000
CHUNK_OVERLAP = 200
GPT4O_MINI_COST_PER_PAGE = 0.002  # $0.002 per page (80% cheaper than GPT-4o)

class MiniProcessor:
    def __init__(self, db_url: str, api_key: str):
        self.db_url = db_url
        self.api_key = api_key
        self.conn = None
        
    def connect_db(self):
        try:
            self.conn = psycopg2.connect(self.db_url)
            print("✅ Database connected")
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            sys.exit(1)
    
    def ensure_connection(self):
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT 1")
            cursor.close()
        except (psycopg2.OperationalError, psycopg2.InterfaceError, AttributeError):
            print("⚠️  Database connection lost, reconnecting...")
            self.connect_db()
    
    def pdf_to_images(self, pdf_path: str, output_dir: str, start_page: int = 1, end_page: int = None) -> List[str]:
        """Convert specific PDF pages to PNG images"""
        print(f"\n📄 Converting PDF pages {start_page}-{end_page or 'end'} to images...")
        
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        try:
            cmd = ['pdftoppm', '-png', '-f', str(start_page)]
            if end_page:
                cmd.extend(['-l', str(end_page)])
            cmd.extend([pdf_path, os.path.join(output_dir, 'page')])
            
            subprocess.run(cmd, check=True)
            
            image_files = sorted(
                [f for f in os.listdir(output_dir) if f.endswith('.png')],
                key=lambda x: int(x.split('-')[1].split('.')[0])
            )
            
            image_paths = [os.path.join(output_dir, f) for f in image_files]
            print(f"📸 Generated {len(image_paths)} page images")
            return image_paths
            
        except subprocess.CalledProcessError as e:
            print(f"❌ PDF conversion failed: {e}")
            return []
    
    def ocr_with_mini(self, image_path: str, page_num: int) -> str:
        """Extract text using GPT-4o Mini (80% cheaper than GPT-4o)"""
        max_retries = 5
        base_delay = 2
        
        for attempt in range(max_retries):
            try:
                with open(image_path, 'rb') as f:
                    image_data = base64.b64encode(f.read()).decode('utf-8')
                
                response = requests.post(
                    'https://routellm.abacus.ai/v1/chat/completions',
                    headers={
                        'Content-Type': 'application/json',
                        'Authorization': f'Bearer {self.api_key}'
                    },
                    json={
                        'model': 'gpt-4o-mini',  # 80% cheaper!
                        'messages': [
                            {
                                'role': 'user',
                                'content': [
                                    {
                                        'type': 'text',
                                        'text': 'Extract all text from this regulatory document page. Maintain structure, headings, and section numbers. Return only the text, no commentary.'
                                    },
                                    {
                                        'type': 'image_url',
                                        'image_url': {
                                            'url': f'data:image/png;base64,{image_data}'
                                        }
                                    }
                                ]
                            }
                        ],
                        'max_tokens': 4096
                    },
                    timeout=120
                )
                
                if response.status_code == 200:
                    data = response.json()
                    time.sleep(0.5)
                    return data['choices'][0]['message']['content']
                elif response.status_code == 429:
                    delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                    print(f"⚠️  Rate limit, waiting {delay:.1f}s (attempt {attempt + 1})")
                    time.sleep(delay)
                elif response.status_code in [500, 502, 503, 504]:
                    delay = base_delay * (2 ** attempt)
                    print(f"⚠️  Server error, retrying in {delay}s")
                    time.sleep(delay)
                else:
                    error_msg = response.text[:500] if response.text else "No error message"
                    print(f"❌ API error: {response.status_code} - {error_msg}")
                    if attempt < max_retries - 1:
                        time.sleep(base_delay)
                    else:
                        return ""
                    
            except Exception as e:
                print(f"❌ Error: {e}")
                if attempt < max_retries - 1:
                    time.sleep(base_delay)
                else:
                    return ""
        
        return ""
    
    def chunk_text(self, text: str) -> List[str]:
        chunks = []
        start = 0
        
        while start < len(text):
            end = min(start + CHUNK_SIZE, len(text))
            chunks.append(text[start:end])
            start += CHUNK_SIZE - CHUNK_OVERLAP
        
        return chunks
    
    def store_chunks(self, regulatory_doc_id: str, chunks: List[str]):
        print(f"\n💾 Storing {len(chunks)} chunks...")
        
        self.ensure_connection()
        cursor = self.conn.cursor()
        
        for i, chunk in enumerate(chunks):
            try:
                metadata = json.dumps({
                    'chunkIndex': i,
                    'totalChunks': len(chunks),
                    'source': 'regulatory',
                    'processor': 'gpt-4o-mini'
                })
                
                cursor.execute(
                    """
                    INSERT INTO "DocumentChunk" 
                    (id, "regulatoryDocumentId", "chunkIndex", content, metadata, "createdAt")
                    VALUES (gen_random_uuid(), %s, %s, %s, %s, NOW())
                    """,
                    (regulatory_doc_id, i, chunk, metadata)
                )
                
            except Exception as e:
                print(f"❌ Chunk {i} error: {e}")
        
        self.conn.commit()
        print(f"✅ Stored {len(chunks)} chunks")
    
    def resume_processing(self, code_type: str, pdf_path: str, project_slug: str):
        """Resume processing from last saved page"""
        print(f"\n🚀 Resuming {code_type.upper()} processing with GPT-4o Mini...\n")
        
        BATCH_SIZE = 50  # Larger batches since Haiku is faster
        MAX_CONSECUTIVE_ERRORS = 3
        
        self.connect_db()
        cursor = self.conn.cursor()
        
        # Find project
        cursor.execute('SELECT id, name FROM "Project" WHERE slug = %s', (project_slug,))
        project = cursor.fetchone()
        
        if not project:
            print(f"❌ Project not found: {project_slug}")
            return
        
        project_id, project_name = project
        print(f"📂 Project: {project_name}")
        
        # Get regulatory document
        if code_type == 'ibc':
            doc_type = 'building_code'
            standard = 'IBC 2021'
        elif code_type == 'nfpa':
            doc_type = 'fire_safety'
            standard = 'NFPA 101 2012'
        else:
            print(f"❌ Unknown code type: {code_type}")
            return
        
        cursor.execute(
            """
            SELECT id, processed, "pagesProcessed", "processingCost" 
            FROM "RegulatoryDocument"
            WHERE "projectId" = %s AND type = %s AND standard = %s
            """,
            (project_id, doc_type, standard)
        )
        result = cursor.fetchone()
        
        if not result:
            print(f"❌ Document record not found for {standard}")
            return
        
        regulatory_doc_id, is_processed, pages_done, cost_so_far = result
        
        if is_processed:
            print(f"✅ {standard} already completed!")
            return
        
        start_page = pages_done + 1 if pages_done else 1
        print(f"📋 Resuming from page {start_page}")
        print(f"💰 Cost so far: ${cost_so_far:.2f}\n")
        
        # Get total pages
        info_result = subprocess.run(['pdfinfo', pdf_path], capture_output=True, text=True)
        total_pages = int([line for line in info_result.stdout.split('\n') if 'Pages:' in line][0].split(':')[1].strip())
        
        print(f"📄 Total pages: {total_pages}")
        print(f"📊 Remaining: {total_pages - start_page + 1} pages")
        print(f"💵 Estimated cost: ${(total_pages - start_page + 1) * GPT4O_MINI_COST_PER_PAGE:.2f}\n")
        
        # Convert remaining pages to images
        temp_dir = f'/tmp/regulatory_{code_type}_resume'
        image_paths = self.pdf_to_images(pdf_path, temp_dir, start_page, total_pages)
        
        if not image_paths:
            print("❌ No images generated")
            return
        
        # Process in batches
        print(f"\n🔤 Processing with Claude 3.5 Haiku (batch size: {BATCH_SIZE})...\n")
        
        total_cost = cost_so_far or 0
        pages_processed = pages_done or 0
        consecutive_errors = 0
        
        for batch_start in range(0, len(image_paths), BATCH_SIZE):
            batch_end = min(batch_start + BATCH_SIZE, len(image_paths))
            batch_text = ""
            
            actual_page_start = start_page + batch_start
            actual_page_end = start_page + batch_end - 1
            
            print(f"\n📦 Batch: Pages {actual_page_start}-{actual_page_end}")
            
            for i in range(batch_start, batch_end):
                page_num = start_page + i
                print(f"\r🔤 Page {page_num}/{total_pages}...", end="", flush=True)
                
                page_text = self.ocr_with_mini(image_paths[i], page_num)
                
                if page_text:
                    batch_text += f"\n\n[Page {page_num}]\n{page_text}"
                    pages_processed += 1
                    total_cost += GPT4O_MINI_COST_PER_PAGE
                    consecutive_errors = 0
                else:
                    consecutive_errors += 1
                    print(f"\n⚠️  Page {page_num} empty (error {consecutive_errors}/{MAX_CONSECUTIVE_ERRORS})")
                    
                    if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                        print(f"\n❌ STOPPING: {MAX_CONSECUTIVE_ERRORS} consecutive errors")
                        print(f"   Progress saved to page {pages_processed}")
                        print(f"   Cost: ${total_cost:.2f}")
                        
                        # Update progress
                        cursor.execute(
                            """
                            UPDATE "RegulatoryDocument"
                            SET "pagesProcessed" = %s,
                                "processingCost" = %s,
                                "processorType" = 'gpt-4o-mini'
                            WHERE id = %s
                            """,
                            (pages_processed, total_cost, regulatory_doc_id)
                        )
                        self.conn.commit()
                        
                        import shutil
                        shutil.rmtree(temp_dir, ignore_errors=True)
                        return
            
            # Chunk and store batch
            print(f"\n📝 Chunking batch text...")
            chunks = self.chunk_text(batch_text)
            print(f"📦 Created {len(chunks)} chunks")
            
            self.store_chunks(regulatory_doc_id, chunks)
            
            # Update progress
            cursor.execute(
                """
                UPDATE "RegulatoryDocument"
                SET "pagesProcessed" = %s,
                    "processingCost" = %s,
                    "processorType" = 'gpt-4o-mini'
                WHERE id = %s
                """,
                (pages_processed, total_cost, regulatory_doc_id)
            )
            self.conn.commit()
            
            print(f"✅ Batch saved: {pages_processed}/{total_pages} pages, ${total_cost:.2f}")
            print(f"⏸️  Waiting 3s before next batch...")
            time.sleep(3)
        
        # Mark as complete
        cursor.execute(
            """
            UPDATE "RegulatoryDocument"
            SET processed = TRUE,
                "pagesProcessed" = %s,
                "processingCost" = %s,
                "processorType" = 'gpt-4o-mini'
            WHERE id = %s
            """,
            (pages_processed, total_cost, regulatory_doc_id)
        )
        self.conn.commit()
        
        print(f"\n\n✅ {standard} COMPLETE!")
        print(f"📊 Total pages: {pages_processed}")
        print(f"💰 Total cost: ${total_cost:.2f}")
        print(f"💵 Savings vs GPT-4o: ${pages_processed * 0.01 - total_cost:.2f} (90%)")
        
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)

def main():
    db_url = os.getenv('DATABASE_URL')
    api_key = os.getenv('ABACUSAI_API_KEY')
    
    if not db_url or not api_key:
        print("❌ Missing environment variables")
        sys.exit(1)
    
    if len(sys.argv) < 2:
        print("Usage: python resume-regulatory-haiku.py [ibc|nfpa|both]")
        sys.exit(1)
    
    code_type = sys.argv[1].lower()
    
    processor = MiniProcessor(db_url, api_key)
    base_path = os.path.join(os.path.dirname(__file__), '../public/regulatory-documents')
    project_slug = 'one-senior-care'
    
    if code_type == 'ibc' or code_type == 'both':
        pdf_path = os.path.join(base_path, 'IBC_2021.pdf')
        if os.path.exists(pdf_path):
            processor.resume_processing('ibc', pdf_path, project_slug)
        else:
            print(f"❌ IBC PDF not found")
    
    if code_type == 'nfpa' or code_type == 'both':
        pdf_path = os.path.join(base_path, 'NFPA_101_2012.pdf')
        if os.path.exists(pdf_path):
            processor.resume_processing('nfpa', pdf_path, project_slug)
        else:
            print(f"❌ NFPA PDF not found")

if __name__ == '__main__':
    main()
