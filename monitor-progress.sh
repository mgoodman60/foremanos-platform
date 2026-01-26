#!/bin/bash

echo "🔄 Starting Regulatory Document Processing Monitor"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Initialize tracking
START_TIME=$(date +%s)
LAST_IBC_PAGE=0
LAST_NFPA_PAGE=0
UPDATE_COUNT=0

while true; do
    UPDATE_COUNT=$((UPDATE_COUNT + 1))
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    
    # Clear screen for clean updates
    clear
    
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║   REGULATORY DOCUMENT PROCESSING - LIVE MONITOR            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo "⏰ Current Time: $(date '+%I:%M:%S %p')"
    echo "⏱️  Elapsed: $((ELAPSED / 60))m $((ELAPSED % 60))s"
    echo "🔄 Update #${UPDATE_COUNT}"
    echo ""
    echo "────────────────────────────────────────────────────────────"
    
    # Get database status
    python3 << 'EOFPY'
from dotenv import load_dotenv
load_dotenv('.env')
import os, psycopg2

try:
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT standard, processed, "pagesProcessed", "processingCost", "processorType"
        FROM "RegulatoryDocument"
        WHERE standard IN ('IBC 2021', 'NFPA 101 2012')
        ORDER BY standard
    """)
    
    results = cursor.fetchall()
    
    for row in results:
        standard, is_done, pages, cost, processor = row
        
        if standard == 'IBC 2021':
            total = 833
            icon = "🏗️"
        else:
            total = 505
            icon = "🔥"
        
        progress_pct = (pages / total) * 100
        remaining = total - pages
        bar_length = 40
        filled = int(bar_length * pages / total)
        bar = "█" * filled + "░" * (bar_length - filled)
        
        status = "✅ COMPLETE" if is_done else "🔄 PROCESSING"
        
        print(f"\n{icon} {standard}")
        print(f"   Status: {status}")
        print(f"   Progress: [{bar}] {progress_pct:.1f}%")
        print(f"   Pages: {pages}/{total} ({remaining} remaining)")
        print(f"   Cost: ${cost:.2f}")
        print(f"   Processor: {processor or 'N/A'}")
        
        if not is_done and remaining > 0:
            est_time = (remaining * 10) / 60  # ~10 sec per page
            print(f"   ETA: ~{int(est_time)} minutes")
    
    conn.close()
    
except Exception as e:
    print(f"\n❌ Database Error: {e}")
EOFPY
    
    echo ""
    echo "────────────────────────────────────────────────────────────"
    
    # Show recent log activity
    echo ""
    echo "📝 Recent Activity:"
    tail -5 /home/ubuntu/construction_project_assistant/logs/regulatory_processing/batch_processing_*.log 2>/dev/null | grep -E "✅ Progress saved|📦 Batch:" | tail -3
    
    echo ""
    echo "────────────────────────────────────────────────────────────"
    echo "⏸️  Press Ctrl+C to stop monitoring (processing continues)"
    echo "════════════════════════════════════════════════════════════"
    
    # Check if processing is complete
    COMPLETE_COUNT=$(python3 << 'EOFPY'
from dotenv import load_dotenv
load_dotenv('.env')
import os, psycopg2

conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cursor = conn.cursor()

cursor.execute("""
    SELECT COUNT(*) 
    FROM "RegulatoryDocument"
    WHERE standard IN ('IBC 2021', 'NFPA 101 2012')
    AND processed = TRUE
""")

print(cursor.fetchone()[0])
conn.close()
EOFPY
)
    
    if [ "$COMPLETE_COUNT" -eq "2" ]; then
        echo ""
        echo "🎉🎉🎉 ALL PROCESSING COMPLETE! 🎉🎉🎉"
        break
    fi
    
    # Wait before next update
    sleep 60
done

echo ""
echo "✅ Monitoring complete!"
