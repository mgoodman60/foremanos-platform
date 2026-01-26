#!/usr/bin/env python3
import os
from dotenv import load_dotenv
load_dotenv('.env')

import psycopg2

db_url = os.getenv('DATABASE_URL')
print(f"DB URL loaded: {bool(db_url)}")

conn = psycopg2.connect(db_url)
print("✅ Connected to database")

cursor = conn.cursor()
cursor.execute(
    """
    SELECT id, standard, processed, "pagesProcessed", "processingCost"
    FROM "RegulatoryDocument"
    WHERE type = 'building_code' AND standard = 'IBC 2021'
    """
)
result = cursor.fetchone()

if result:
    doc_id, standard, processed, pages, cost = result
    print(f"\n📄 {standard}")
    print(f"   Processed: {processed}")
    print(f"   Pages done: {pages}")
    print(f"   Cost: ${cost:.2f}")
    print(f"   Doc ID: {doc_id}")
else:
    print("❌ No IBC document found")

conn.close()
