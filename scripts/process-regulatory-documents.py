#!/usr/bin/env python3
"""
Regulatory Document Processing Script
Processes regulatory PDFs (like ADA 2010 Standards) using Claude Haiku OCR
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
from typing import List, Dict, Any
import psycopg2
from datetime import datetime

# Configuration
CHUNK_SIZE = 2000  # Characters per chunk
CHUNK_OVERLAP = 200  # Overlap between chunks
GPT4O_COST_PER_PAGE = 0.01  # $0.01 per page with GPT-4o Vision

class RegulatoryDocumentProcessor:
    def __init__(self, db_url: str, api_key: str):
        self.db_url = db_url
        self.api_key = api_key
        self.conn = None
        
    def connect_db(self):
        """Connect to PostgreSQL database"""
        try:
            self.conn = psycopg2.connect(self.db_url)
            print("✅ Database connected")
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            sys.exit(1)
    
    def ensure_connection(self):
        """Ensure database connection is alive, reconnect if needed"""
        try:
            # Test connection
            cursor = self.conn.cursor()
            cursor.execute("SELECT 1")
            cursor.close()
        except (psycopg2.OperationalError, psycopg2.InterfaceError, AttributeError):
            print("⚠️  Database connection lost, reconnecting...")
            self.connect_db()
    
    def pdf_to_images(self, pdf_path: str, output_dir: str, max_pages: int = None) -> List[str]:
        """Convert PDF pages to PNG images"""
        print(f"\n📄 Converting PDF to images: {pdf_path}")
        
        # Create output directory
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        # Use pdftoppm to convert PDF to images
        try:
            cmd = ['pdftoppm', '-png', pdf_path, os.path.join(output_dir, 'page')]
            
            # Add page limit if specified
            if max_pages:
                cmd.extend(['-l', str(max_pages)])
                print(f"⚠️  Processing first {max_pages} pages only (test mode)")
            
            subprocess.run(cmd, check=True)
            
            # Get all generated PNG files
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
    
    def ocr_page_with_claude(self, image_path: str, page_num: int) -> str:
        """Extract text from image using Claude Haiku with retry logic"""
        max_retries = 5  # Increased from implicit 1 to 5 attempts
        base_delay = 2  # Start with 2 seconds
        
        for attempt in range(max_retries):
            try:
                # Read image and convert to base64
                with open(image_path, 'rb') as f:
                    image_data = base64.b64encode(f.read()).decode('utf-8')
                
                # Call GPT-4o API for vision with timeout
                response = requests.post(
                    'https://routellm.abacus.ai/v1/chat/completions',
                    headers={
                        'Content-Type': 'application/json',
                        'Authorization': f'Bearer {self.api_key}'
                    },
                    json={
                        'model': 'gpt-4o',
                        'messages': [
                            {
                                'role': 'user',
                                'content': [
                                    {
                                        'type': 'text',
                                        'text': 'Extract all text from this regulatory document page. Maintain the original structure, headings, and section numbers. Return only the extracted text, no commentary.'
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
                    timeout=120  # 2 minute timeout per request
                )
                
                if response.status_code == 200:
                    data = response.json()
                    # Success - add small delay to avoid rate limits
                    time.sleep(0.5)
                    return data['choices'][0]['message']['content']
                elif response.status_code == 429:  # Rate limit
                    delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                    print(f"⚠️  Rate limit hit on page {page_num}, waiting {delay:.1f}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(delay)
                elif response.status_code in [500, 502, 503, 504]:  # Server errors
                    delay = base_delay * (2 ** attempt)
                    print(f"⚠️  Server error {response.status_code} on page {page_num}, retrying in {delay}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(delay)
                else:
                    error_text = response.text[:200] if response.text else 'No error message'
                    print(f"❌ API error for page {page_num}: {response.status_code} - {error_text}")
                    if attempt < max_retries - 1:
                        time.sleep(base_delay)
                    else:
                        return ""
                    
            except requests.exceptions.Timeout:
                delay = base_delay * (2 ** attempt)
                print(f"⚠️  Timeout on page {page_num}, retrying in {delay}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(delay)
            except requests.exceptions.ConnectionError:
                delay = base_delay * (2 ** attempt)
                print(f"⚠️  Connection error on page {page_num}, retrying in {delay}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(delay)
            except Exception as e:
                print(f"❌ Error processing page {page_num}: {e}")
                if attempt < max_retries - 1:
                    time.sleep(base_delay)
                else:
                    return ""
        
        print(f"❌ Failed to process page {page_num} after {max_retries} attempts")
        return ""
    
    def chunk_text(self, text: str) -> List[str]:
        """Split text into overlapping chunks"""
        chunks = []
        start = 0
        
        while start < len(text):
            end = min(start + CHUNK_SIZE, len(text))
            chunks.append(text[start:end])
            start += CHUNK_SIZE - CHUNK_OVERLAP
        
        return chunks
    
    def store_chunks(self, regulatory_doc_id: str, chunks: List[str]):
        """Store text chunks in database"""
        print(f"\n💾 Storing {len(chunks)} chunks in database...")
        
        # Ensure database connection is alive
        self.ensure_connection()
        
        cursor = self.conn.cursor()
        
        for i, chunk in enumerate(chunks):
            try:
                metadata = json.dumps({
                    'chunkIndex': i,
                    'totalChunks': len(chunks),
                    'source': 'regulatory'
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
                print(f"❌ Error storing chunk {i}: {e}")
        
        self.conn.commit()
        print(f"✅ Stored {len(chunks)} chunks successfully")
    
    def update_regulatory_document(self, doc_id: str, pages_processed: int, total_cost: float):
        """Update regulatory document status"""
        # Ensure database connection is alive
        self.ensure_connection()
        
        cursor = self.conn.cursor()
        
        cursor.execute(
            """
            UPDATE "RegulatoryDocument"
            SET processed = TRUE,
                "processorType" = 'gpt-4o-vision',
                "processingCost" = %s,
                "pagesProcessed" = %s
            WHERE id = %s
            """,
            (total_cost, pages_processed, doc_id)
        )
        
        self.conn.commit()
        print(f"✅ Updated regulatory document status")
    
    def process_ada_standards(self, pdf_path: str, project_slug: str, max_pages: int = None):
        """Process ADA 2010 Standards PDF with batch processing"""
        print("🚀 Starting ADA 2010 Standards processing...\n")
        
        BATCH_SIZE = 25  # Process and commit every 25 pages
        MAX_CONSECUTIVE_ERRORS = 3
        
        # Connect to database
        self.connect_db()
        cursor = self.conn.cursor()
        
        # Find project
        cursor.execute(
            'SELECT id, name, slug FROM "Project" WHERE slug = %s',
            (project_slug,)
        )
        project = cursor.fetchone()
        
        if not project:
            print(f"❌ Project not found: {project_slug}")
            return
        
        project_id, project_name, _ = project
        print(f"📂 Project: {project_name} ({project_slug})")
        
        # Check if ADA doc already exists
        cursor.execute(
            """
            SELECT id, processed, "pagesProcessed" FROM "RegulatoryDocument"
            WHERE "projectId" = %s
              AND type = 'ada'
              AND standard = 'ADA 2010 Standards'
            """,
            (project_id,)
        )
        result = cursor.fetchone()
        
        if result and result[1]:  # Already fully processed
            print("⚠️  ADA document already processed. Skipping...")
            return
        
        if not result:
            # Create regulatory document record
            print("📄 Creating ADA regulatory document record...")
            cursor.execute(
                """
                INSERT INTO "RegulatoryDocument"
                (id, "projectId", type, jurisdiction, standard, version, "sourceUrl", processed, "lastUpdated", "expiresAt", "createdAt", "updatedAt")
                VALUES (gen_random_uuid(), %s, 'ada', 'Federal', 'ADA 2010 Standards', '2010', %s, FALSE, NOW(), NOW() + INTERVAL '5 years', NOW(), NOW())
                RETURNING id
                """,
                (project_id, 'https://archive.ada.gov/regs2010/2010ADAStandards/2010ADAStandards.pdf')
            )
            regulatory_doc_id = cursor.fetchone()[0]
            self.conn.commit()
            start_page = 0
        else:
            regulatory_doc_id = result[0]
            start_page = result[2] if result[2] else 0
            if start_page > 0:
                print(f"📋 Resuming from page {start_page + 1}")
        
        print(f"📋 Regulatory Doc ID: {regulatory_doc_id}\n")
        
        # Convert PDF to images
        temp_dir = '/tmp/regulatory_images'
        image_paths = self.pdf_to_images(pdf_path, temp_dir, max_pages)
        
        if not image_paths:
            print("❌ No images generated. Exiting.")
            return
        
        # Process pages in batches
        print(f"\n🔤 Processing {len(image_paths)} pages with GPT-4o Vision (batch size: {BATCH_SIZE})...")
        
        total_pages_processed = start_page
        total_cost = total_pages_processed * GPT4O_COST_PER_PAGE
        consecutive_errors = 0
        
        for batch_start in range(start_page, len(image_paths), BATCH_SIZE):
            batch_end = min(batch_start + BATCH_SIZE, len(image_paths))
            batch_text = ""
            batch_pages = 0
            
            print(f"\n📦 Batch {batch_start//BATCH_SIZE + 1}: Pages {batch_start + 1}-{batch_end}")
            
            for i in range(batch_start, batch_end):
                page_num = i + 1
                print(f"\r🔤 Page {page_num}/{len(image_paths)}...", end="", flush=True)
                
                page_text = self.ocr_page_with_claude(image_paths[i], page_num)
                
                if page_text:
                    batch_text += f"\n\n[Page {page_num}]\n{page_text}"
                    batch_pages += 1
                    consecutive_errors = 0
                else:
                    consecutive_errors += 1
                    print(f"\n⚠️  Warning: Page {page_num} returned empty result (error {consecutive_errors}/{MAX_CONSECUTIVE_ERRORS})")
                    
                    if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                        print(f"\n\n❌ STOPPING: {MAX_CONSECUTIVE_ERRORS} consecutive errors. Likely API issue or credit exhaustion.")
                        print(f"   Progress saved up to page {total_pages_processed}")
                        print(f"   Restart script to resume from page {total_pages_processed + 1}")
                        import shutil
                        shutil.rmtree(temp_dir, ignore_errors=True)
                        return
            
            # Process this batch
            if batch_pages > 0:
                print(f"\n📝 Chunking batch text...")
                batch_chunks = self.chunk_text(batch_text)
                print(f"📦 Created {len(batch_chunks)} chunks for this batch")
                
                # Store chunks
                self.store_chunks(regulatory_doc_id, batch_chunks)
                
                # Update progress
                total_pages_processed += batch_pages
                total_cost = total_pages_processed * GPT4O_COST_PER_PAGE
                
                # Ensure connection and recreate cursor after potential reconnection
                self.ensure_connection()
                cursor = self.conn.cursor()
                
                cursor.execute(
                    """
                    UPDATE "RegulatoryDocument"
                    SET "pagesProcessed" = %s,
                        "processingCost" = %s,
                        "updatedAt" = NOW()
                    WHERE id = %s
                    """,
                    (total_pages_processed, total_cost, regulatory_doc_id)
                )
                self.conn.commit()
                
                print(f"✅ Batch saved: {total_pages_processed}/{len(image_paths)} pages, ${total_cost:.2f} cost")
                
                # Add delay between batches to prevent rate limiting
                if batch_start + BATCH_SIZE < len(image_paths):
                    print(f"⏸️  Waiting 5s before next batch to avoid rate limits...")
                    time.sleep(5)
        
        # Mark as fully processed
        cursor.execute(
            """
            UPDATE "RegulatoryDocument"
            SET processed = TRUE,
                "processorType" = 'gpt-4o-vision'
            WHERE id = %s
            """,
            (regulatory_doc_id,)
        )
        self.conn.commit()
        
        # Clean up temp images
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)
        
        print("\n\n🎉 SUCCESS! ADA 2010 Standards are now available for RAG queries.")
        print(f"   Pages processed: {total_pages_processed}")
        print(f"   Total cost: ${total_cost:.2f}")
    
    def process_ibc_2021(self, pdf_path: str, project_slug: str, max_pages: int = None):
        """Process IBC 2021 (International Building Code) PDF with batch processing"""
        print("🚀 Starting IBC 2021 processing...\n")
        
        BATCH_SIZE = 25  # Process and commit every 25 pages
        MAX_CONSECUTIVE_ERRORS = 3
        
        # Connect to database
        self.connect_db()
        cursor = self.conn.cursor()
        
        # Find project
        cursor.execute(
            'SELECT id, name, slug FROM "Project" WHERE slug = %s',
            (project_slug,)
        )
        project = cursor.fetchone()
        
        if not project:
            print(f"❌ Project not found: {project_slug}")
            return
        
        project_id, project_name, _ = project
        print(f"📂 Project: {project_name} ({project_slug})")
        
        # Check if IBC doc already exists
        cursor.execute(
            """
            SELECT id, processed, "pagesProcessed" FROM "RegulatoryDocument"
            WHERE "projectId" = %s
              AND type = 'building_code'
              AND standard = 'IBC 2021'
            """,
            (project_id,)
        )
        result = cursor.fetchone()
        
        if result and result[1]:  # Already fully processed
            print("⚠️  IBC 2021 document already processed. Skipping...")
            return
        
        if not result:
            # Create regulatory document record
            print("📄 Creating IBC 2021 regulatory document record...")
            cursor.execute(
                """
                INSERT INTO "RegulatoryDocument"
                (id, "projectId", type, jurisdiction, standard, version, "sourceUrl", processed, "lastUpdated", "expiresAt", "createdAt", "updatedAt")
                VALUES (gen_random_uuid(), %s, 'building_code', 'Federal', 'IBC 2021', '2021', %s, FALSE, NOW(), NOW() + INTERVAL '5 years', NOW(), NOW())
                RETURNING id
                """,
                (project_id, 'https://codes.iccsafe.org/content/IBC2021P2')
            )
            regulatory_doc_id = cursor.fetchone()[0]
            self.conn.commit()
            start_page = 0
        else:
            regulatory_doc_id = result[0]
            start_page = result[2] if result[2] else 0
            if start_page > 0:
                print(f"📋 Resuming from page {start_page + 1}")
        
        print(f"📋 Regulatory Doc ID: {regulatory_doc_id}\n")
        
        # Convert PDF to images
        temp_dir = '/tmp/regulatory_images_ibc'
        image_paths = self.pdf_to_images(pdf_path, temp_dir, max_pages)
        
        if not image_paths:
            print("❌ No images generated. Exiting.")
            return
        
        # Process pages in batches
        print(f"\n🔤 Processing {len(image_paths)} pages with GPT-4o Vision (batch size: {BATCH_SIZE})...")
        
        total_pages_processed = start_page
        total_cost = total_pages_processed * GPT4O_COST_PER_PAGE
        consecutive_errors = 0
        
        for batch_start in range(start_page, len(image_paths), BATCH_SIZE):
            batch_end = min(batch_start + BATCH_SIZE, len(image_paths))
            batch_text = ""
            batch_pages = 0
            
            print(f"\n📦 Batch {batch_start//BATCH_SIZE + 1}: Pages {batch_start + 1}-{batch_end}")
            
            for i in range(batch_start, batch_end):
                page_num = i + 1
                print(f"\r🔤 Page {page_num}/{len(image_paths)}...", end="", flush=True)
                
                page_text = self.ocr_page_with_claude(image_paths[i], page_num)
                
                if page_text:
                    batch_text += f"\n\n[Page {page_num}]\n{page_text}"
                    batch_pages += 1
                    consecutive_errors = 0
                else:
                    consecutive_errors += 1
                    print(f"\n⚠️  Warning: Page {page_num} returned empty result (error {consecutive_errors}/{MAX_CONSECUTIVE_ERRORS})")
                    
                    if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                        print(f"\n\n❌ STOPPING: {MAX_CONSECUTIVE_ERRORS} consecutive errors. Likely API issue or credit exhaustion.")
                        print(f"   Progress saved up to page {total_pages_processed}")
                        print(f"   Restart script to resume from page {total_pages_processed + 1}")
                        import shutil
                        shutil.rmtree(temp_dir, ignore_errors=True)
                        return
            
            # Process this batch
            if batch_pages > 0:
                print(f"\n📝 Chunking batch text...")
                batch_chunks = self.chunk_text(batch_text)
                print(f"📦 Created {len(batch_chunks)} chunks for this batch")
                
                # Store chunks
                self.store_chunks(regulatory_doc_id, batch_chunks)
                
                # Update progress
                total_pages_processed += batch_pages
                total_cost = total_pages_processed * GPT4O_COST_PER_PAGE
                
                # Ensure connection and recreate cursor after potential reconnection
                self.ensure_connection()
                cursor = self.conn.cursor()
                
                cursor.execute(
                    """
                    UPDATE "RegulatoryDocument"
                    SET "pagesProcessed" = %s,
                        "processingCost" = %s,
                        "updatedAt" = NOW()
                    WHERE id = %s
                    """,
                    (total_pages_processed, total_cost, regulatory_doc_id)
                )
                self.conn.commit()
                
                print(f"✅ Batch saved: {total_pages_processed}/{len(image_paths)} pages, ${total_cost:.2f} cost")
                
                # Add delay between batches to prevent rate limiting
                if batch_start + BATCH_SIZE < len(image_paths):
                    print(f"⏸️  Waiting 5s before next batch to avoid rate limits...")
                    time.sleep(5)
        
        # Mark as fully processed
        self.ensure_connection()
        cursor = self.conn.cursor()
        cursor.execute(
            """
            UPDATE "RegulatoryDocument"
            SET processed = TRUE,
                "processorType" = 'gpt-4o-vision'
            WHERE id = %s
            """,
            (regulatory_doc_id,)
        )
        self.conn.commit()
        
        # Clean up temp images
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)
        
        print("\n\n🎉 SUCCESS! IBC 2021 is now available for RAG queries.")
        print(f"   Pages processed: {total_pages_processed}")
        print(f"   Total cost: ${total_cost:.2f}")
    
    def process_nfpa_101(self, pdf_path: str, project_slug: str, max_pages: int = None):
        """Process NFPA 101 Life Safety Code (2012 Edition) PDF with batch processing"""
        print("🚀 Starting NFPA 101 2012 processing...\n")
        
        BATCH_SIZE = 25  # Process and commit every 25 pages
        MAX_CONSECUTIVE_ERRORS = 3
        
        # Connect to database
        self.connect_db()
        cursor = self.conn.cursor()
        
        # Find project
        cursor.execute(
            'SELECT id, name, slug FROM "Project" WHERE slug = %s',
            (project_slug,)
        )
        project = cursor.fetchone()
        
        if not project:
            print(f"❌ Project not found: {project_slug}")
            return
        
        project_id, project_name, _ = project
        print(f"📂 Project: {project_name} ({project_slug})")
        
        # Check if NFPA 101 doc already exists
        cursor.execute(
            """
            SELECT id, processed, "pagesProcessed" FROM "RegulatoryDocument"
            WHERE "projectId" = %s
              AND type = 'fire_safety'
              AND standard = 'NFPA 101 2012'
            """,
            (project_id,)
        )
        result = cursor.fetchone()
        
        if result and result[1]:  # Already fully processed
            print("⚠️  NFPA 101 2012 document already processed. Skipping...")
            return
        
        if not result:
            # Create regulatory document record
            print("📄 Creating NFPA 101 2012 regulatory document record...")
            cursor.execute(
                """
                INSERT INTO "RegulatoryDocument"
                (id, "projectId", type, jurisdiction, standard, version, "sourceUrl", processed, "lastUpdated", "expiresAt", "createdAt", "updatedAt")
                VALUES (gen_random_uuid(), %s, 'fire_safety', 'Federal', 'NFPA 101 2012', '2012', %s, FALSE, NOW(), NOW() + INTERVAL '5 years', NOW(), NOW())
                RETURNING id
                """,
                (project_id, 'https://archive.org/details/gov.law.nfpa.101.bis.2012')
            )
            regulatory_doc_id = cursor.fetchone()[0]
            self.conn.commit()
            start_page = 0
        else:
            regulatory_doc_id = result[0]
            start_page = result[2] if result[2] else 0
            if start_page > 0:
                print(f"📋 Resuming from page {start_page + 1}")
        
        print(f"📋 Regulatory Doc ID: {regulatory_doc_id}\n")
        
        # Convert PDF to images
        temp_dir = '/tmp/regulatory_images_nfpa'
        image_paths = self.pdf_to_images(pdf_path, temp_dir, max_pages)
        
        if not image_paths:
            print("❌ No images generated. Exiting.")
            return
        
        # Process pages in batches
        print(f"\n🔤 Processing {len(image_paths)} pages with GPT-4o Vision (batch size: {BATCH_SIZE})...")
        
        total_pages_processed = start_page
        total_cost = total_pages_processed * GPT4O_COST_PER_PAGE
        consecutive_errors = 0
        
        for batch_start in range(start_page, len(image_paths), BATCH_SIZE):
            batch_end = min(batch_start + BATCH_SIZE, len(image_paths))
            batch_text = ""
            batch_pages = 0
            
            print(f"\n📦 Batch {batch_start//BATCH_SIZE + 1}: Pages {batch_start + 1}-{batch_end}")
            
            for i in range(batch_start, batch_end):
                page_num = i + 1
                print(f"\r🔤 Page {page_num}/{len(image_paths)}...", end="", flush=True)
                
                page_text = self.ocr_page_with_claude(image_paths[i], page_num)
                
                if page_text:
                    batch_text += f"\n\n[Page {page_num}]\n{page_text}"
                    batch_pages += 1
                    consecutive_errors = 0
                else:
                    consecutive_errors += 1
                    print(f"\n⚠️  Warning: Page {page_num} returned empty result (error {consecutive_errors}/{MAX_CONSECUTIVE_ERRORS})")
                    
                    if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                        print(f"\n\n❌ STOPPING: {MAX_CONSECUTIVE_ERRORS} consecutive errors. Likely API issue or credit exhaustion.")
                        print(f"   Progress saved up to page {total_pages_processed}")
                        print(f"   Restart script to resume from page {total_pages_processed + 1}")
                        import shutil
                        shutil.rmtree(temp_dir, ignore_errors=True)
                        return
            
            # Process this batch
            if batch_pages > 0:
                print(f"\n📝 Chunking batch text...")
                batch_chunks = self.chunk_text(batch_text)
                print(f"📦 Created {len(batch_chunks)} chunks for this batch")
                
                # Store chunks
                self.store_chunks(regulatory_doc_id, batch_chunks)
                
                # Update progress
                total_pages_processed += batch_pages
                total_cost = total_pages_processed * GPT4O_COST_PER_PAGE
                
                # Ensure connection and recreate cursor after potential reconnection
                self.ensure_connection()
                cursor = self.conn.cursor()
                
                cursor.execute(
                    """
                    UPDATE "RegulatoryDocument"
                    SET "pagesProcessed" = %s,
                        "processingCost" = %s,
                        "updatedAt" = NOW()
                    WHERE id = %s
                    """,
                    (total_pages_processed, total_cost, regulatory_doc_id)
                )
                self.conn.commit()
                
                print(f"✅ Batch saved: {total_pages_processed}/{len(image_paths)} pages, ${total_cost:.2f} cost")
                
                # Add delay between batches to prevent rate limiting
                if batch_start + BATCH_SIZE < len(image_paths):
                    print(f"⏸️  Waiting 5s before next batch to avoid rate limits...")
                    time.sleep(5)
        
        # Mark as fully processed
        self.ensure_connection()
        cursor = self.conn.cursor()
        cursor.execute(
            """
            UPDATE "RegulatoryDocument"
            SET processed = TRUE,
                "processorType" = 'gpt-4o-vision'
            WHERE id = %s
            """,
            (regulatory_doc_id,)
        )
        self.conn.commit()
        
        # Clean up temp images
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)
        
        print("\n\n🎉 SUCCESS! NFPA 101 2012 is now available for RAG queries.")
        print(f"   Pages processed: {total_pages_processed}")
        print(f"   Total cost: ${total_cost:.2f}")

def main():
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    db_url = os.getenv('DATABASE_URL')
    api_key = os.getenv('ABACUSAI_API_KEY')
    
    if not db_url or not api_key:
        print("❌ Missing required environment variables: DATABASE_URL, ABACUSAI_API_KEY")
        sys.exit(1)
    
    # Parse command line arguments
    code_type = 'ada'  # Default to ADA
    max_pages = None
    
    if len(sys.argv) > 1:
        code_type = sys.argv[1].lower()
        if code_type not in ['ada', 'ibc', 'nfpa']:
            print(f"❌ Invalid code type: {code_type}")
            print("Usage: python process-regulatory-documents.py [ada|ibc|nfpa] [max_pages]")
            sys.exit(1)
    
    if len(sys.argv) > 2:
        try:
            max_pages = int(sys.argv[2])
            print(f"ℹ️  TEST MODE: Processing first {max_pages} pages only")
        except ValueError:
            print(f"⚠️  Invalid page limit: {sys.argv[2]}, processing all pages")
    
    # Initialize processor
    processor = RegulatoryDocumentProcessor(db_url, api_key)
    
    # Determine which code to process
    base_path = os.path.join(os.path.dirname(__file__), '../public/regulatory-documents')
    project_slug = 'one-senior-care'
    
    if code_type == 'ada':
        pdf_path = os.path.join(base_path, 'ADA_2010_Standards.pdf')
        if not os.path.exists(pdf_path):
            print(f"❌ PDF not found: {pdf_path}")
            sys.exit(1)
        processor.process_ada_standards(pdf_path, project_slug, max_pages)
    
    elif code_type == 'ibc':
        pdf_path = os.path.join(base_path, 'IBC_2021.pdf')
        if not os.path.exists(pdf_path):
            print(f"❌ PDF not found: {pdf_path}")
            sys.exit(1)
        processor.process_ibc_2021(pdf_path, project_slug, max_pages)
    
    elif code_type == 'nfpa':
        pdf_path = os.path.join(base_path, 'NFPA_101_2012.pdf')
        if not os.path.exists(pdf_path):
            print(f"❌ PDF not found: {pdf_path}")
            sys.exit(1)
        processor.process_nfpa_101(pdf_path, project_slug, max_pages)

if __name__ == '__main__':
    main()
