'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Upload, X, FlipHorizontal } from 'lucide-react';
import { toast } from 'sonner';

interface MobilePhotoCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onUploadComplete: () => void;
}

export function MobilePhotoCapture({
  open,
  onOpenChange,
  conversationId,
  onUploadComplete,
}: MobilePhotoCaptureProps) {
  const [mode, setMode] = useState<'choose' | 'camera' | 'file'>('choose');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      setMode('camera');
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const switchCamera = async () => {
    stopCamera();
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    setTimeout(() => startCamera(), 100);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(imageData);
      stopCamera();
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setCapturedImage(reader.result as string);
      setMode('file');
    };
    reader.readAsDataURL(file);
  };

  const uploadPhoto = async () => {
    if (!capturedImage) return;

    try {
      setUploading(true);
      
      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      // Compress image
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };
      
      const imageCompression = (await import('browser-image-compression')).default;
      const compressedBlob = await imageCompression(blob as File, options);
      
      // Create file
      const file = new File(
        [compressedBlob],
        `photo_${Date.now()}.jpg`,
        { type: 'image/jpeg' }
      );
      
      // Upload to server
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadResponse = await fetch(
        `/api/conversations/${conversationId}/photos-quick`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload photo');
      }

      toast.success('Photo uploaded successfully');
      onUploadComplete();
      handleClose();
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setMode('choose');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-dark-card border-gray-700 text-white max-w-4xl">
        <DialogHeader>
          <DialogTitle>Capture Photo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode Selection */}
          {mode === 'choose' && (
            <div className="flex flex-col gap-4 py-8">
              <Button
                onClick={startCamera}
                className="bg-orange-500 hover:bg-orange-600 text-white h-16 text-lg"
              >
                <Camera className="w-6 h-6 mr-3" />
                Take Photo with Camera
              </Button>
              
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-dark-surface h-16 text-lg"
              >
                <Upload className="w-6 h-6 mr-3" />
                Choose from Gallery
              </Button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Camera View */}
          {mode === 'camera' && !capturedImage && (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-lg bg-black"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                <Button
                  onClick={switchCamera}
                  variant="outline"
                  size="icon"
                  className="bg-black/50 border-white/30 hover:bg-black/70 text-white"
                >
                  <FlipHorizontal className="w-5 h-5" />
                </Button>
                
                <Button
                  onClick={capturePhoto}
                  size="lg"
                  className="bg-orange-500 hover:bg-orange-600 text-white rounded-full w-16 h-16"
                >
                  <Camera className="w-6 h-6" />
                </Button>
                
                <Button
                  onClick={handleClose}
                  variant="outline"
                  size="icon"
                  className="bg-black/50 border-white/30 hover:bg-black/70 text-white"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Preview & Upload */}
          {capturedImage && (
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-full rounded-lg"
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={retakePhoto}
                  variant="outline"
                  disabled={uploading}
                  className="flex-1 border-gray-600 text-gray-300 hover:bg-dark-surface"
                >
                  Retake
                </Button>
                
                <Button
                  onClick={uploadPhoto}
                  disabled={uploading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
