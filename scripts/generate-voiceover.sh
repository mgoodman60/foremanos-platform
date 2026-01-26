#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VOICEOVER_SCRIPT="$PROJECT_ROOT/assets/tour/voiceover_script.txt"
VOICEOVER_OUTPUT="$PROJECT_ROOT/public/foremanos-tour-voice.mp3"

# Create the voiceover script
cat > "$VOICEOVER_SCRIPT" << 'VOICESCRIPT'
If your day is calls, texts, and putting out fires — this is for you.
ForemanOS is your field operations home base.
The dashboard shows what's happening right now — crews, jobs, and priorities.
Scheduling and dispatch keep work flowing, without the constant phone tag.
Forms and checklists replace clipboards, so the paperwork gets done on site.
Communication stays tied to the job, not buried in message threads.
Quotes and client info stay organized, so you're not rebuilding it every time.
And reporting gives you a clean view of what's working — and what's slipping.
ForemanOS brings control back to the job.
Request a demo and see it in action.
VOICESCRIPT

echo "Voiceover script created at: $VOICEOVER_SCRIPT"

# Generate voiceover using edge-tts
echo "Generating voiceover with Microsoft Edge TTS..."
edge-tts \
  --voice "en-US-GuyNeural" \
  --text "$(cat "$VOICEOVER_SCRIPT")" \
  --write-media "$VOICEOVER_OUTPUT"

echo "Voiceover generated successfully at: $VOICEOVER_OUTPUT"

# Get duration
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$VOICEOVER_OUTPUT")
echo "Voiceover duration: ${DURATION}s"
