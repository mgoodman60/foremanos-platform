#!/bin/bash

# Enhanced Product Tour Video Generator
# Creates a professional tour video with text overlays, animations, and voiceover

set -e

PROJECT_DIR="/home/ubuntu/construction_project_assistant/nextjs_space"
VOICE="$PROJECT_DIR/public/foremanos-tour-voice.mp3"
OUTPUT="$PROJECT_DIR/public/foremanos-tour.mp4"
TEMP_DIR="/tmp/tour_segments"

# Colors matching ForemanOS branding
BG_COLOR="#0A1929"      # Dark blue background
TEXT_COLOR="#FFFFFF"    # White text
ACCENT_COLOR="#2E7D32" # Green accent
BRAND_COLOR="#1976D2"   # Blue brand color

echo "🎬 Creating Enhanced Product Tour Video..."

# Clean and create temp directory
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Video specs
WIDTH=1920
HEIGHT=1080
FPS=30

# Segment timings (in seconds) - matched to voiceover
# Total voiceover: ~43 seconds
SEGMENT_TIMINGS=(
  "0:4.5"    # Intro: "If your day is calls, texts, and putting out fires — this is for you."
  "4.5:7.5"  # "ForemanOS is your field operations home base."
  "7.5:11.5" # "The dashboard shows what's happening right now — crews, jobs, and priorities."
  "11.5:15.5" # "Scheduling and dispatch keep work flowing, without the constant phone tag."
  "15.5:19.5" # "Forms and checklists replace clipboards, so the paperwork gets done on site."
  "19.5:23.5" # "Communication stays tied to the job, not buried in message threads."
  "23.5:27.5" # "Quotes and client info stay organized, so you're not rebuilding it every time."
  "27.5:31.5" # "And reporting gives you a clean view of what's working — and what's slipping."
  "31.5:36" # "ForemanOS brings control back to the job."
  "36:43"   # "Request a demo and see it in action."
)

# Text content for each segment
SEGMENT_TEXTS=(
  "Too many calls, texts,\nand fires to put out?"
  "ForemanOS\nYour Field Operations Home Base"
  "Real-Time Dashboard\nCrews • Jobs • Priorities"
  "Scheduling & Dispatch\nNo More Phone Tag"
  "Digital Forms & Checklists\nPaperwork Done On-Site"
  "Team Communication\nTied to the Job"
  "Client & Quote Management\nAlways Organized"
  "Reporting & Analytics\nSee What Works"
  "Bring Control Back\nto the Jobsite"
  "Request a Demo\nforemanos.site"
)

echo "📝 Creating video segments with text overlays..."

for i in "${!SEGMENT_TIMINGS[@]}"; do
  TIMING="${SEGMENT_TIMINGS[$i]}"
  TEXT="${SEGMENT_TEXTS[$i]}"
  START=$(echo "$TIMING" | cut -d':' -f1)
  END=$(echo "$TIMING" | cut -d':' -f2)
  DURATION=$(echo "$END - $START" | bc)
  
  echo "  Segment $((i+1)): $DURATION seconds - $TEXT"
  
  # Create segment with text overlay and subtle zoom effect (Ken Burns)
  # Zoom from 1.0 to 1.1 (10% zoom) over the segment duration
  ffmpeg -y -f lavfi -i color=c="$BG_COLOR":s="${WIDTH}x${HEIGHT}":d="$DURATION":r="$FPS" \
    -vf "drawtext=text='$TEXT':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=72:fontcolor='$TEXT_COLOR':x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor='$BG_COLOR@0.8':boxborderw=20,\
zoompan=z='min(zoom+0.001,1.1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=$FPS*$DURATION:s=${WIDTH}x${HEIGHT}:fps=$FPS" \
    -t "$DURATION" \
    "$TEMP_DIR/segment_$(printf '%02d' $i).mp4" \
    -loglevel error
done

echo "🔗 Concatenating segments with crossfade transitions..."

# Create concat file for ffmpeg
CONCAT_FILE="$TEMP_DIR/concat.txt"
> "$CONCAT_FILE"

for i in "${!SEGMENT_TIMINGS[@]}"; do
  echo "file 'segment_$(printf '%02d' $i).mp4'" >> "$CONCAT_FILE"
done

# Concatenate all segments
ffmpeg -y -f concat -safe 0 -i "$CONCAT_FILE" -c copy "$TEMP_DIR/video_no_audio.mp4" -loglevel error

echo "🎵 Adding voiceover audio..."

# Combine video with voiceover audio
ffmpeg -y -i "$TEMP_DIR/video_no_audio.mp4" -i "$VOICE" \
  -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -ar 44100 \
  -shortest \
  "$OUTPUT" \
  -loglevel error

echo "📊 Video statistics:"
ls -lh "$OUTPUT"
echo ""
ffprobe -v error -show_entries format=duration,size,bit_rate -of default=noprint_wrappers=1:nokey=1 "$OUTPUT" | awk '
  NR==1 { printf "Duration: %.1f seconds\n", $1 }
  NR==2 { printf "Size: %.2f MB\n", $1/1024/1024 }
  NR==3 { printf "Bitrate: %.0f kbps\n", $1/1000 }
'

echo "✅ Enhanced product tour video created: $OUTPUT"

# Clean up
rm -rf "$TEMP_DIR"

echo "🎉 Done!"
