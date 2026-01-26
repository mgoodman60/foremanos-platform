#!/bin/bash
cd /home/ubuntu/construction_project_assistant/nextjs_space
source <(cat .env | grep -E "DATABASE_URL|ABACUSAI_API_KEY" | sed 's/^/export /')
cd scripts
python3 resume-regulatory-haiku.py both 2>&1 | tee /home/ubuntu/construction_project_assistant/logs/regulatory_processing/haiku_resume_$(date +%Y%m%d_%H%M%S).log
