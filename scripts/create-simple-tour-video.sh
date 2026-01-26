#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VOICE_FILE="$PROJECT_ROOT/public/foremanos-tour-voice.mp3"
OUTPUT_VIDEO="$PROJECT_ROOT/public/foremanos-tour.mp3"

# For now, just copy the voiceover as the tour file
# This will be replaced with actual video once screenshots are captured
cp "$VOICE_FILE" "$OUTPUT_VIDEO"

echo "Simple tour audio created at: $OUTPUT_VIDEO"
echo "Note: This is audio-only. Full video will be created once all pages are built."
