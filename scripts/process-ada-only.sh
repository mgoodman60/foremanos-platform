#!/bin/bash
# Process only ADA 2010 Standards (279 pages)

set -e

LOG_DIR="/home/ubuntu/construction_project_assistant/logs/regulatory_processing"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "======================================"
echo "Processing ADA 2010 Standards"
echo "Started: $(date)"
echo "======================================"
echo ""

START_TIME=$(date +%s)
python3 /home/ubuntu/construction_project_assistant/nextjs_space/scripts/process-regulatory-documents.py ada 2>&1 | tee "$LOG_DIR/ada_${TIMESTAMP}.log"
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

HOURS=$(echo "scale=2; $DURATION / 3600" | bc)

echo ""
echo "======================================"
echo "✅ ADA 2010 Processing Complete!"
echo "======================================"
echo "Pages:     279"
echo "Duration:  ${DURATION}s (~${HOURS}h)"
echo "Cost:      ~\$2.79"
echo "Finished:  $(date)"
echo "======================================"
