#!/bin/bash
# Process all regulatory codes sequentially - Phase 1: ADA + NFPA + IBC

set -e  # Exit on error

LOG_DIR="/home/ubuntu/construction_project_assistant/logs/regulatory_processing"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "======================================"
echo "Phase 1: Regulatory Code Processing"
echo "Started: $(date)"
echo "======================================"
echo ""

# Process ADA 2010 (279 pages, ~$2.79)
echo "📋 [1/3] Processing ADA 2010 Standards (279 pages)..."
START_TIME=$(date +%s)
python3 /home/ubuntu/construction_project_assistant/nextjs_space/scripts/process-regulatory-documents.py ada 2>&1 | tee "$LOG_DIR/ada_${TIMESTAMP}.log"
END_TIME=$(date +%s)
ADA_DURATION=$((END_TIME - START_TIME))
echo "✅ ADA 2010 complete in ${ADA_DURATION}s"
echo ""

sleep 5

# Process NFPA 101 2012 (505 pages, ~$5.05)
echo "📋 [2/3] Processing NFPA 101 2012 Life Safety Code (505 pages)..."
START_TIME=$(date +%s)
python3 /home/ubuntu/construction_project_assistant/nextjs_space/scripts/process-regulatory-documents.py nfpa 2>&1 | tee "$LOG_DIR/nfpa_${TIMESTAMP}.log"
END_TIME=$(date +%s)
NFPA_DURATION=$((END_TIME - START_TIME))
echo "✅ NFPA 101 complete in ${NFPA_DURATION}s"
echo ""

sleep 5

# Process IBC 2021 (833 pages, ~$8.33)
echo "📋 [3/3] Processing IBC 2021 International Building Code (833 pages)..."
START_TIME=$(date +%s)
python3 /home/ubuntu/construction_project_assistant/nextjs_space/scripts/process-regulatory-documents.py ibc 2>&1 | tee "$LOG_DIR/ibc_${TIMESTAMP}.log"
END_TIME=$(date +%s)
IBC_DURATION=$((END_TIME - START_TIME))
echo "✅ IBC 2021 complete in ${IBC_DURATION}s"
echo ""

TOTAL_DURATION=$((ADA_DURATION + NFPA_DURATION + IBC_DURATION))
TOTAL_HOURS=$(echo "scale=2; $TOTAL_DURATION / 3600" | bc)

echo "======================================"
echo "🎉 PHASE 1 COMPLETE!"
echo "======================================"
echo "ADA 2010:    279 pages in ${ADA_DURATION}s (~\$2.79)"
echo "NFPA 101:    505 pages in ${NFPA_DURATION}s (~\$5.05)"
echo "IBC 2021:    833 pages in ${IBC_DURATION}s (~\$8.33)"
echo "--------------------------------------"
echo "Total:      1,617 pages in ${TOTAL_DURATION}s (~${TOTAL_HOURS}h)"
echo "Total Cost: ~\$16.17"
echo "Finished:   $(date)"
echo "======================================"
