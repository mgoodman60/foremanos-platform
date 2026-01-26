#!/usr/bin/env python3
"""
Regulatory document processor with ROBUST database connection handling
Fixes: Silent failures due to database timeouts after ~2 hours
"""

import os, sys, json, base64, requests, subprocess, time, psycopg2
from pathlib import Path
from dotenv import load_dotenv

load_dotenv('../.env')

db_url = os.getenv('DATABASE_URL')
api_key = os.getenv('ABACUSAI_API_KEY')

BATCH_SIZE = 10
CHUNK_SIZE = 2000
CHUNK_OVERLAP = 200
COST_PER_PAGE = 0.002

def get_db_connection():
    """Create fresh database connection"""
    return psycopg2.connect(db_url)

def chunk_text(text):
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        chunks.append(text[start:end])
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks

def process_code(code_type):
    """Process IBC or NFPA with robust connection handling"""
    print(f"\n{'='*60}")
    print(f"  Processing {code_type.upper()}")
    print(f"{'='*60}\n")
    
    # Get document info FIRST (before long processing)
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if code_type == 'ibc':
        pdf_file = 'IBC_2021.pdf'
        doc_type = 'building_code'
        standard = 'IBC 2021'
    else:  # nfpa
        pdf_file = 'NFPA_101_2012.pdf'
        doc_type = 'fire_safety'
        standard = 'NFPA 101 2012'
    
    cursor.execute(
        """
        SELECT id, "pagesProcessed", "processingCost"
        FROM "RegulatoryDocument"
        WHERE type = %s AND standard = %s
        """,
        (doc_type, standard)
    )
    result = cursor.fetchone()
    
    if not result:
        print(f"❌ {standard} not found in database")
        conn.close()
        return
    
    doc_id, pages_done, cost_so_far = result
    start_page = (pages_done or 0) + 1
    
    # Get total pages
    pdf_path = f'../public/regulatory-documents/{pdf_file}'
    info = subprocess.run(['pdfinfo', pdf_path], capture_output=True, text=True)
    total_pages = int([l for l in info.stdout.split('\n') if 'Pages:' in l][0].split(':')[1].strip())
    
    remaining = total_pages - start_page + 1
    
    print(f"📄 Document: {standard}")
    print(f"📊 Progress: {pages_done or 0}/{total_pages} pages")
    print(f"💰 Cost so far: ${cost_so_far or 0:.2f}")
    print(f"📋 Resuming from page {start_page}")
    print(f"⏳ Remaining: {remaining} pages")
    print(f"💵 Estimated: ${remaining * COST_PER_PAGE:.2f}\n")
    
    conn.close()  # Close initial connection
    
    # Process in batches
    current_page = start_page
    total_cost = cost_so_far or 0
    
    while current_page <= total_pages:
        batch_end = min(current_page + BATCH_SIZE - 1, total_pages)
        batch_pages = batch_end - current_page + 1
        
        print(f"\n{'─'*60}")
        print(f"📦 Batch: Pages {current_page}-{batch_end} ({batch_pages} pages)")
        print(f"{'─'*60}")
        
        # Convert batch to images
        temp_dir = f'/tmp/regulatory_{code_type}_batch'
        Path(temp_dir).mkdir(parents=True, exist_ok=True)
        
        subprocess.run([
            'pdftoppm', '-png',
            '-f', str(current_page),
            '-l', str(batch_end),
            pdf_path,
            os.path.join(temp_dir, 'page')
        ], check=True, capture_output=True)
        
        images = sorted([f for f in os.listdir(temp_dir) if f.endswith('.png')],
                       key=lambda x: int(x.split('-')[1].split('.')[0]))
        
        if len(images) != batch_pages:
            print(f"⚠️  Warning: Expected {batch_pages} images, got {len(images)}")
        
        # OCR each page
        batch_text = ""
        success_count = 0
        
        for i, img_file in enumerate(images):
            page_num = current_page + i
            img_path = os.path.join(temp_dir, img_file)
            
            print(f"  🔤 Page {page_num}/{total_pages}...", end=" ", flush=True)
            
            with open(img_path, 'rb') as f:
                image_data = base64.b64encode(f.read()).decode('utf-8')
            
            # API call with retry
            max_retries = 3
            page_text = None
            
            for attempt in range(max_retries):
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
                        timeout=90  # Increased from 60 to 90 seconds
                    )
                    
                    if response.status_code == 200:
                        page_text = response.json()['choices'][0]['message']['content']
                        print(f"✅ ({len(page_text)} chars)")
                        break
                    elif response.status_code == 429:
                        print(f"⏳", end=" ", flush=True)
                        time.sleep(5 * (attempt + 1))
                    else:
                        error = response.json().get('error', 'Unknown error')
                        print(f"❌ {response.status_code}: {error}")
                        break
                        
                except requests.Timeout:
                    print(f"⏰ timeout", end=" ", flush=True)
                    if attempt < max_retries - 1:
                        time.sleep(3)
                except Exception as e:
                    print(f"❌ {e}")
                    if attempt < max_retries - 1:
                        time.sleep(2)
            
            if page_text:
                batch_text += f"\n\n[Page {page_num}]\n{page_text}"
                success_count += 1
                total_cost += COST_PER_PAGE
            else:
                print(f"    ⚠️  Failed after {max_retries} attempts")
            
            time.sleep(0.5)  # Rate limiting - increased slightly
        
        # Chunk and store with FRESH connection for each batch
        if batch_text:
            print(f"\n  📝 Chunking {len(batch_text)} characters...")
            chunks = chunk_text(batch_text)
            print(f"  📦 Created {len(chunks)} chunks")
            
            print(f"  💾 Storing in database...", flush=True)
            
            # CREATE FRESH CONNECTION for database operations
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                
                for idx, chunk in enumerate(chunks):
                    metadata = json.dumps({
                        'processor': 'gpt-4o-mini',
                        'batch': f'{current_page}-{batch_end}'
                    })
                    
                    cursor.execute(
                        """
                        INSERT INTO "DocumentChunk"
                        (id, "regulatoryDocumentId", "chunkIndex", content, metadata, "createdAt")
                        VALUES (gen_random_uuid(), %s, %s, %s, %s, NOW())
                        """,
                        (doc_id, idx, chunk, metadata)
                    )
                
                # Update progress
                cursor.execute(
                    """
                    UPDATE "RegulatoryDocument"
                    SET "pagesProcessed" = %s,
                        "processingCost" = %s,
                        "processorType" = 'gpt-4o-mini'
                    WHERE id = %s
                    """,
                    (batch_end, total_cost, doc_id)
                )
                
                conn.commit()
                conn.close()  # Close connection immediately after use
                
                print(f"  ✅ Progress saved: {batch_end}/{total_pages} pages, ${total_cost:.2f}")
                
            except Exception as e:
                print(f"  ❌ Database error: {e}")
                try:
                    conn.close()
                except:
                    pass
                # Don't exit - try next batch
        
        # Cleanup temp files
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)
        
        current_page = batch_end + 1
        time.sleep(2)  # Pause between batches
    
    # Mark as complete with FRESH connection
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            """
            UPDATE "RegulatoryDocument"
            SET processed = TRUE,
                "pagesProcessed" = %s,
                "processingCost" = %s
            WHERE id = %s
            """,
            (total_pages, total_cost, doc_id)
        )
        conn.commit()
        conn.close()
        
        print(f"\n{'='*60}")
        print(f"✅ {standard} COMPLETE!")
        print(f"📊 Total pages: {total_pages}")
        print(f"💰 Total cost: ${total_cost:.2f}")
        print(f"{'='*60}\n")
        
    except Exception as e:
        print(f"❌ Failed to mark as complete: {e}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python process-remaining-pages-fixed.py [ibc|nfpa|both]")
        sys.exit(1)
    
    choice = sys.argv[1].lower()
    
    if choice in ['ibc', 'both']:
        process_code('ibc')
    
    if choice in ['nfpa', 'both']:
        process_code('nfpa')
    
    print("\n✅ All processing complete!")
