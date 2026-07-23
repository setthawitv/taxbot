"use client";

import { useEffect, useRef, useState } from "react";

// Live camera capture using getUserMedia. Unlike an <input capture> file
// picker (which only opens the camera on mobile), this opens the actual
// webcam on desktop too. Returns a JPEG data URL via onCapture.
export default function CameraCapture({
  onCapture, onClose,
}: {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("เบราว์เซอร์นี้ไม่รองรับกล้อง — ใช้ “เลือกจากคลัง” แทนได้");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } }, audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch {
        setError("เปิดกล้องไม่ได้ — โปรดอนุญาตการเข้าถึงกล้อง หรือใช้ “เลือกจากคลัง” แทน");
      }
    }
    start();
    return () => { cancelled = true; stop(); };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    stop();
    onCapture(dataUrl);
  }

  function close() { stop(); onClose(); }

  return (
    <div className="fixed inset-0 bg-black z-[60] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="font-semibold">ถ่ายรูปใบเสร็จ</span>
        <button onClick={close} className="text-3xl leading-none" aria-label="ปิด">×</button>
      </div>

      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="text-center px-8">
            <p className="text-white/80 text-sm leading-relaxed">{error}</p>
            <button onClick={close} className="mt-4 px-5 py-2.5 rounded-xl bg-white text-gray-900 text-sm font-semibold">ปิด</button>
          </div>
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video ref={videoRef} playsInline muted className="max-h-full max-w-full" />
        )}
      </div>

      {!error && (
        <div className="p-6 flex justify-center">
          <button
            onClick={capture}
            disabled={!ready}
            aria-label="ถ่ายภาพ"
            className="w-16 h-16 rounded-full bg-white ring-4 ring-white/30 active:scale-95 disabled:opacity-40 transition-transform"
          />
        </div>
      )}
    </div>
  );
}
