'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import type { FaceLandmarkResult } from '@/types';

interface CameraCaptureProps {
  onCapture: (imageData: string, landmarks: FaceLandmarkResult) => void;
}

export function CameraCapture({ onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasFace, setHasFace] = useState(false);
  const [landmarkResult, setLandmarkResult] = useState<FaceLandmarkResult | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize MediaPipe FaceLandmarker
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
        );
        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7,
        });

        if (!mounted) return;
        faceLandmarkerRef.current = faceLandmarker;
        setInitialized(true);
      } catch (e) {
        console.error('FaceLandmarker init failed:', e);
        setCameraError('Face detection failed to load. Try uploading a photo instead.');
      }
    };

    init();
    return () => {
      mounted = false;
      stopCamera();
    };
  }, []);

  // Start camera when initialized
  useEffect(() => {
    if (!initialized || !videoRef.current) return;
    startCamera();
  }, [initialized]);

  function startCamera() {
    if (!videoRef.current) return;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } })
      .then((stream) => {
        if (!videoRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
          videoRef.current?.play();
          runDetection();
        };
      })
      .catch(() => {
        setCameraError('Camera access denied or unavailable. Use the file upload below.');
      });
  }

  function stopCamera() {
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function runDetection() {
    const video = videoRef.current;
    const landmarker = faceLandmarkerRef.current;
    if (!video || !landmarker || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(runDetection);
      return;
    }

    const result = landmarker.detectForVideo(video, performance.now());

    if (result.faceLandmarks?.length) {
      setHasFace(true);
      const lm = result.faceLandmarks[0];
      setLandmarkResult({
        landmarks: lm.map((p) => ({ x: p.x, y: p.y, z: p.z })),
        imageWidth: video.videoWidth,
        imageHeight: video.videoHeight,
      });
      drawLandmarks(lm, video.videoWidth, video.videoHeight);
    } else {
      setHasFace(false);
      clearCanvas();
    }

    animFrameRef.current = requestAnimationFrame(runDetection);
  }

  function drawLandmarks(landmarks: { x: number; y: number; z: number }[], w: number, h: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);

    // Face oval
    const faceOval = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < faceOval.length; i++) {
      const pt = landmarks[faceOval[i]];
      if (!pt) continue;
      const x = pt.x * w;
      const y = pt.y * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    // Eyes
    const leftEye = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
    const rightEye = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
    [leftEye, rightEye].forEach((eye) => {
      ctx.beginPath();
      for (let i = 0; i < eye.length; i++) {
        const pt = landmarks[eye[i]];
        if (!pt) continue;
        const x = pt.x * w;
        const y = pt.y * h;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    });

    // Jawline
    const jawline = [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323];
    ctx.beginPath();
    for (let i = 0; i < jawline.length; i++) {
      const pt = landmarks[jawline[i]];
      if (!pt) continue;
      const x = pt.x * w;
      const y = pt.y * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }

  const capture = useCallback(() => {
    if (!hasFace || !landmarkResult || !videoRef.current) return;

    const c = document.createElement('canvas');
    c.width = videoRef.current.videoWidth;
    c.height = videoRef.current.videoHeight;
    c.getContext('2d')!.drawImage(videoRef.current, 0, 0);
    onCapture(c.toDataURL('image/jpeg', 0.9), landmarkResult);
  }, [hasFace, landmarkResult, onCapture]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Please select a JPG, PNG, or WebP image');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large (max 10MB)');
      return;
    }

    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      c.getContext('2d')!.drawImage(img, 0, 0);

      const landmarker = faceLandmarkerRef.current;
      if (landmarker) {
        // Use VIDEO mode - need to feed frames via a video element
        const tempVideo = document.createElement('video');
        tempVideo.width = img.width;
        tempVideo.height = img.height;
        tempVideo.src = c.toDataURL('image/jpeg', 0.9);
        tempVideo.muted = true;
        tempVideo.playsInline = true;
        tempVideo.onloadeddata = () => {
          tempVideo.play().then(() => {
            // Give it a moment to process the frame
            setTimeout(() => {
              const result = landmarker.detectForVideo(tempVideo, performance.now());
              URL.revokeObjectURL(tempVideo.src);
              if (result.faceLandmarks?.length) {
                const lm = result.faceLandmarks[0];
                onCapture(c.toDataURL('image/jpeg', 0.9), {
                  landmarks: lm.map((p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y, z: p.z })),
                  imageWidth: img.width,
                  imageHeight: img.height,
                });
              } else {
                // No face detected - still allow upload
                onCapture(c.toDataURL('image/jpeg', 0.9), {
                  landmarks: [],
                  imageWidth: img.width,
                  imageHeight: img.height,
                });
              }
            }, 100);
          });
        };
      } else {
        onCapture(c.toDataURL('image/jpeg', 0.9), {
          landmarks: [],
          imageWidth: img.width,
          imageHeight: img.height,
        });
      }
    };
    img.src = URL.createObjectURL(file);
    // Reset input so re-selecting the same file triggers onChange
    e.target.value = '';
  }, [onCapture]);

  return (
    <div className="relative">
      {cameraError ? (
        <div className="w-full max-w-md mx-auto text-center">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
            <p className="text-red-600 dark:text-red-400 text-sm font-medium">{cameraError}</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl text-lg font-medium transition-colors"
            >
              Upload a Photo
            </button>
          </div>
        </div>
      ) : (
        <>
          <video ref={videoRef} className="w-full max-w-md mx-auto rounded-xl" autoPlay playsInline muted />
          <canvas ref={canvasRef} className="absolute top-0 left-0 w-full max-w-md mx-auto rounded-xl pointer-events-none" />
          <div className="mt-4 flex gap-3 justify-center">
            <button
              onClick={capture}
              disabled={!hasFace}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-400 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl text-lg font-medium transition-colors"
            >
              {hasFace ? 'Capture & Score' : 'Position face in frame...'}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 px-4 py-3 rounded-xl text-sm font-medium transition-colors"
            >
              Upload
            </button>
          </div>
          {!hasFace && initialized && (
            <p className="text-center text-zinc-500 dark:text-zinc-400 text-sm mt-2">
              Center your face, ensure good lighting, look at camera
            </p>
          )}
        </>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}