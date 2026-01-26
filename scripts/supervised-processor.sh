#!/bin/bash
# Self-supervising processor that restarts on failure
# Runs until both documents are complete

LOG_DIR="/home/ubuntu/construction_project_assistant/logs/regulatory_processing"
SCRIPT_DIR="/home/ubuntu/construction_project_assistant/nextjs_space/scripts"
MAX_RESTARTS=100
RESTART_COUNT=0

echo "╔════════════════════════════════════════════════════════════╗"
echo "║      SELF-SUPERVISING REGULATORY PROCESSOR v1.0            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "⏰ Started: $(date)"
echo "📋 Max restarts: $MAX_RESTARTS"
echo "🔄 Will automatically restart on failures"
echo ""

while [ $RESTART_COUNT -lt $MAX_RESTARTS ]; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🚀 Attempt #$((RESTART_COUNT + 1)) - $(date '+%I:%M:%S %p')"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Check if processing is complete
    COMPLETE_COUNT=$(cd $SCRIPT_DIR && python3 << 'EOFPY'
from dotenv import load_dotenv
load_dotenv('../.env')
import os, psycopg2

conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cursor = conn.cursor()
cursor.execute("""
    SELECT COUNT(*) FROM "RegulatoryDocument"
    WHERE standard IN ('IBC 2021', 'NFPA 101 2012')
    AND processed = TRUE
""")
count = cursor.fetchone()[0]
conn.close()
print(count)
EOFPY
)
    
    if [ "$COMPLETE_COUNT" == "2" ]; then
        echo ""
        echo "🎉🎉🎉 ALL DOCUMENTS PROCESSED! 🎉🎉🎉"
        echo "⏰ Completed: $(date)"
        echo "🔄 Total restarts needed: $RESTART_COUNT"
        break
    fi
    
    # Show current progress
    cd $SCRIPT_DIR && python3 << 'EOFPY'
from dotenv import load_dotenv
load_dotenv('../.env')
import os, psycopg2

conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cursor = conn.cursor()
cursor.execute("""
    SELECT standard, "pagesProcessed", "processingCost"
    FROM "RegulatoryDocument"
    WHERE standard IN ('IBC 2021', 'NFPA 101 2012')
    ORDER BY standard
""")

for standard, pages, cost in cursor.fetchall():
    total = 833 if 'IBC' in standard else 505
    pct = (pages / total) * 100
    print(f"   {standard}: {pages}/{total} ({pct:.1f}%) - ${cost:.2f}")

conn.close()
EOFPY
    
    # Start processing
    LOG_FILE="$LOG_DIR/supervised_run_$(date +%Y%m%d_%H%M%S).log"
    echo ""
    echo "📝 Log: $LOG_FILE"
    echo "🔄 Processing..."
    echo ""
    
    cd $SCRIPT_DIR
    timeout 7200 python3 -u process-remaining-pages-fixed.py both >> "$LOG_FILE" 2>&1
    EXIT_CODE=$?
    
    RESTART_COUNT=$((RESTART_COUNT + 1))
    
    if [ $EXIT_CODE -eq 124 ]; then
        echo "⏰ Timeout after 2 hours - restarting..."
    elif [ $EXIT_CODE -ne 0 ]; then
        echo "❌ Process exited with code $EXIT_CODE - restarting..."
    else
        echo "✅ Process completed normally"
    fi
    
    # Wait before restart (exponential backoff: 5, 10, 15, 20, max 30 seconds)
    WAIT_TIME=$((5 * RESTART_COUNT))
    if [ $WAIT_TIME -gt 30 ]; then
        WAIT_TIME=30
    fi
    
    echo "⏸️  Waiting ${WAIT_TIME}s before restart..."
    sleep $WAIT_TIME
done

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📊 FINAL SUMMARY"
echo "═══════════════════════════════════════════════════════════"

cd $SCRIPT_DIR && python3 << 'EOFPY'
from dotenv import load_dotenv
load_dotenv('../.env')
import os, psycopg2

conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cursor = conn.cursor()

cursor.execute("""
    SELECT standard, processed, "pagesProcessed", "processingCost"
    FROM "RegulatoryDocument"
    WHERE standard IN ('IBC 2021', 'NFPA 101 2012')
    ORDER BY standard
""")

total_cost = 0
for standard, done, pages, cost in cursor.fetchall():
    total = 833 if 'IBC' in standard else 505
    status = "✅ COMPLETE" if done else "⚠️  INCOMPLETE"
    print(f"\n{standard}: {status}")
    print(f"  Pages: {pages}/{total}")
    print(f"  Cost: ${cost:.2f}")
    total_cost += cost

print(f"\n💰 Total Cost: ${total_cost:.2f}")
conn.close()
EOFPY

echo ""
echo "═══════════════════════════════════════════════════════════"
