'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Square, Loader2, Volume2 } from 'lucide-react';
import { toast } from 'sonner';

interface VoiceRecorderProps {
  projectSlug: string;
  onTranscription: (result: {
    transcription: string;
    structured: {
      workPerformed?: string;
      workPlanned?: string;
      delays?: string;
      safety?: string;
      materials?: string;
      notes?: string;
    };
  }) => void;
  currentReport?: {
    workPerformed?: string;
    workPlanned?: string;
    notes?: string;
  };
}

export default function VoiceRecorder({
  projectSlug,
  onTranscription,
  currentReport,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up audio analysis for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Visualize audio level
      const updateLevel = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average / 255);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop audio analysis
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        audioContext.close();
        stream.getTracks().forEach(track => track.stop());

        // Process recording
        await processRecording();
      };

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.start(100); // Collect data every 100ms

      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const processRecording = async () => {
    if (chunksRef.current.length === 0) {
      toast.error('No audio recorded');
      return;
    }

    setIsProcessing(true);

    try {
      // Convert to base64
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );

      // Send to API
      const response = await fetch(`/api/projects/${projectSlug}/daily-reports/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64,
          currentReport,
        }),
      });

      const data = await response.json();

      if (data.success && data.transcription) {
        onTranscription({
          transcription: data.transcription,
          structured: data.structured,
        });
        toast.success('Voice transcribed successfully');
      } else {
        toast.error('Failed to transcribe audio');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error('Failed to process recording');
    } finally {
      setIsProcessing(false);
      chunksRef.current = [];
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3">
      {isProcessing ? (
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-600 text-gray-300"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          Transcribing...
        </button>
      ) : isRecording ? (
        <>
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors"
          >
            <Square className="w-4 h-4" />
            Stop
          </button>
          
          {/* Recording indicator */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <div
                className="w-8 h-8 rounded-full bg-red-500/30 flex items-center justify-center"
                style={{
                  transform: `scale(${1 + audioLevel * 0.5})`,
                  transition: 'transform 0.1s ease',
                }}
              >
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              </div>
            </div>
            <span className="text-red-400 font-mono text-sm">
              {formatTime(recordingTime)}
            </span>
          </div>

          {/* Audio level bars */}
          <div className="flex items-center gap-0.5 h-6">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-red-400 rounded transition-all"
                style={{
                  height: `${Math.max(4, audioLevel * 24 * (1 - i * 0.15))}px`,
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <button
          onClick={startRecording}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
        >
          <Mic className="w-4 h-4 text-red-400" />
          Voice Note
        </button>
      )}
    </div>
  );
}
