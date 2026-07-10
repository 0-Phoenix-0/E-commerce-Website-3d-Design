'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { api } from '@/lib/api';
import type { Product } from '@/types';

interface UploadSignData {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
}

interface TryOnTask {
  taskIds: number[];
  status: string;
}

interface TryOnStatus {
  status: 'ACCEPTED' | 'WAITING' | 'PROCESSING' | 'DONE' | 'ERROR' | 'CANCELLED' | 'PAUSED';
  images: string[];
  error: string | null;
}

type Step = 'pick' | 'uploading' | 'generating' | 'done' | 'error';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

interface TryOnModalProps {
  product: Product;
  onClose: () => void;
}

export default function TryOnModal({ product, onClose }: TryOnModalProps) {
  const [step, setStep] = useState<Step>('pick');
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling + object URLs on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (photo) URL.revokeObjectURL(photo.preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photo) URL.revokeObjectURL(photo.preview);
    setPhoto({ file, preview: URL.createObjectURL(file) });
    setErrorMessage('');
  }

  function fail(message: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    setErrorMessage(message);
    setStep('error');
  }

  function startPolling(taskIds: number[]) {
    const startedAt = Date.now();
    const completed = new Set<number>();
    const images: string[] = [];

    pollRef.current = setInterval(async () => {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        fail('Generation is taking too long. Please try again.');
        return;
      }

      // Poll all tasks in parallel
      const results = await Promise.all(
        taskIds.map(async (taskId) => {
          if (completed.has(taskId)) return null; // already finished
          try {
            const res = await api.get<TryOnStatus>(`/try-on/${taskId}`);
            if (!res.success || !res.data) return null;
            return { taskId, ...res.data };
          } catch {
            return null;
          }
        })
      );

      for (const result of results) {
        if (!result) continue;

        if (result.status === 'DONE') {
          completed.add(result.taskId);
          images.push(...result.images);
        } else if (['ERROR', 'CANCELLED'].includes(result.status)) {
          fail(result.error || 'Generation failed. Please try a different photo.');
          return;
        }
      }

      // All three tasks done
      if (completed.size === taskIds.length) {
        if (pollRef.current) clearInterval(pollRef.current);
        setResultImages(images);
        setStep('done');
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleGenerate() {
    if (!photo) return;
    setErrorMessage('');
    setStep('uploading');

    try {
      // 1. Get signed upload params for the customer photo
      const signRes = await api.post<UploadSignData>('/try-on/sign', {});
      if (!signRes.success || !signRes.data) {
        throw new Error(signRes.message || 'Failed to prepare photo upload.');
      }

      // 2. Upload photo directly to Cloudinary
      const form = new FormData();
      form.append('file', photo.file);
      form.append('api_key', signRes.data.apiKey);
      form.append('timestamp', String(signRes.data.timestamp));
      form.append('signature', signRes.data.signature);
      form.append('folder', signRes.data.folder);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${signRes.data.cloudName}/image/upload`,
        { method: 'POST', body: form }
      );
      if (!uploadRes.ok) throw new Error('Photo upload failed. Please try again.');
      const uploadData = (await uploadRes.json()) as { secure_url: string };

      // 3. Start the AI try-on generation (3 views: front, side, back)
      const createRes = await api.post<TryOnTask>('/try-on', {
        productId: product._id,
        photoUrl: uploadData.secure_url,
      });
      if (!createRes.success || !createRes.data) {
        throw new Error(createRes.message || 'Failed to start try-on generation.');
      }

      setStep('generating');
      startPolling(createRes.data.taskIds);
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  function handleRetry() {
    setResultImages([]);
    setErrorMessage('');
    setStep('pick');
  }

  function openLightbox(index: number) {
    setZoomed(false);
    setLightboxIndex(index);
  }

  function closeLightbox() {
    setLightboxIndex(null);
    setZoomed(false);
  }

  function showRelative(delta: number) {
    setZoomed(false);
    setLightboxIndex((prev) =>
      prev === null ? prev : (prev + delta + resultImages.length) % resultImages.length
    );
  }

  // Keyboard nav for the lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') showRelative(1);
      else if (e.key === 'ArrowLeft') showRelative(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIndex, resultImages.length]);

  const busy = step === 'uploading' || step === 'generating';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/35 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      <div
        className={`tryon-pop relative bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 w-full max-h-[90vh] overflow-y-auto text-left transition-[max-width] duration-300 ${
          step === 'done' ? 'max-w-3xl' : 'max-w-md'
        }`}
      >
        {/* Header with product context */}
        <div className="relative flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gradient-to-b from-gray-50/70 to-white rounded-t-3xl">
          <div className="relative h-12 w-12 shrink-0 rounded-xl overflow-hidden ring-1 ring-black/5 bg-gray-100">
            {product.images?.[0]?.url ? (
              <Image src={product.images[0].url} alt={product.name} fill className="object-cover" unoptimized />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-white text-[9px] leading-none">✨</span>
              <h3 className="text-base font-bold text-gray-900 truncate">Try It On Yourself</h3>
            </div>
            <p className="text-[11px] text-gray-500 truncate">
              AI preview of you wearing <span className="font-semibold text-gray-700">{product.name}</span>
            </p>
          </div>
          <button
            onClick={() => !busy && onClose()}
            disabled={busy}
            aria-label="Close"
            className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">

        {/* Step: pick photo */}
        {(step === 'pick' || step === 'error') && (
          <div className="space-y-4">
            {errorMessage && (
              <div className="rounded-xl px-4 py-3 text-sm font-semibold bg-red-50 border border-red-200 text-red-700">
                {errorMessage}
              </div>
            )}

            {photo ? (
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
                <Image src={photo.preview} alt="Your photo" fill className="object-cover" unoptimized />
                <button
                  onClick={() => {
                    URL.revokeObjectURL(photo.preview);
                    setPhoto(null);
                  }}
                  className="absolute top-2 right-2 p-1 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <label className="group relative flex flex-col items-center justify-center gap-3 aspect-[3/4] rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-gray-700 transition-colors cursor-pointer select-none bg-gradient-to-b from-gray-50 to-white">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white ring-1 ring-gray-200 shadow-sm group-hover:ring-indigo-300 group-hover:scale-105 transition-all">
                  <svg className="w-8 h-8 text-gray-400 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </span>
                <span className="text-sm font-bold text-gray-700">Upload your photo</span>
                <span className="text-[11px] text-gray-400 px-8 text-center leading-relaxed">
                  A full-body, front-facing photo with good lighting works best
                </span>
                <div className="flex flex-wrap items-center justify-center gap-1.5 px-6">
                  {['Full body', 'Good light', 'Front-facing'].map((t) => (
                    <span key={t} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-semibold text-gray-500">{t}</span>
                  ))}
                </div>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/avif" className="hidden" onChange={handleFileChange} />
              </label>
            )}

            <button
              onClick={handleGenerate}
              disabled={!photo}
              className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:bg-gray-950"
            >
              ✨ Generate My Try-On
            </button>
            <p className="flex items-center justify-center gap-1 text-[10px] text-gray-400 text-center">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Your photo is only used to generate this preview.
            </p>
          </div>
        )}

        {/* Step: uploading / generating */}
        {busy && (
          <div className="flex flex-col items-center justify-center py-14 space-y-4">
            <span className="w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
            <p className="text-sm font-bold text-gray-900">
              {step === 'uploading' ? 'Uploading your photo…' : 'Generating your try-on…'}
            </p>
            <p className="text-xs text-gray-400 text-center px-6">
              {step === 'uploading'
                ? 'Hang tight, this only takes a moment.'
                : 'Our AI is creating 3 views (front, side, back). This usually takes 30–90 seconds.'}
            </p>
          </div>
        )}

        {/* Step: done */}
        {step === 'done' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {resultImages.map((url, idx) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => openLightbox(idx)}
                  className="group block space-y-2 text-left"
                >
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                    {/* Claid result URLs are temporary external links — plain img avoids next/image domain config */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`${['Front view', 'Side view', 'Back view'][idx]}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/25 transition-colors">
                      <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.35-5.4a6.75 6.75 0 11-13.5 0 6.75 6.75 0 0113.5 0zM10.5 7.5v6m3-3h-6" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-gray-600 text-center">
                    {['Front view', 'Side view', 'Back view'][idx]}
                  </p>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 text-center">Click any image to zoom &amp; browse</p>
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                className="flex-1 py-3 bg-gray-950 hover:bg-gray-900 text-white text-sm font-bold rounded-2xl transition-all"
              >
                Try Another Photo
              </button>
            </div>
            <p className="text-[10px] text-gray-400 text-center">
              Result links expire after 24 hours — save the image if you like it!
            </p>
          </div>
        )}
        </div>
      </div>

      {/* Lightbox: fullscreen zoom + prev/next */}
      {lightboxIndex !== null && resultImages[lightboxIndex] && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90">
          {/* Backdrop click closes */}
          <div className="absolute inset-0" onClick={closeLightbox} />

          {/* Close */}
          <button
            onClick={closeLightbox}
            aria-label="Close"
            className="absolute top-4 right-4 z-10 p-2 text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Prev */}
          {resultImages.length > 1 && (
            <button
              onClick={() => showRelative(-1)}
              aria-label="Previous"
              className="absolute left-3 sm:left-6 z-10 p-2 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}

          {/* Image */}
          <div className="gallery-no-scrollbar relative z-[1] max-w-[92vw] max-h-[86vh] overflow-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={resultImages[lightboxIndex]}
              src={resultImages[lightboxIndex]}
              alt={`${['Front view', 'Side view', 'Back view'][lightboxIndex]}`}
              onClick={() => setZoomed((z) => !z)}
              className={`select-none transition-all duration-300 ease-out ${
                zoomed
                  ? 'max-w-none max-h-none w-[150%] sm:w-[120%] h-auto cursor-zoom-out'
                  : 'gallery-fade max-w-[92vw] max-h-[86vh] object-contain cursor-zoom-in'
              }`}
            />
          </div>

          {/* Next */}
          {resultImages.length > 1 && (
            <button
              onClick={() => showRelative(1)}
              aria-label="Next"
              className="absolute right-3 sm:right-6 z-10 p-2 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}

          {/* Caption + counter */}
          <div className="absolute bottom-5 left-0 right-0 z-10 text-center text-white/90 text-sm font-semibold pointer-events-none">
            {['Front view', 'Side view', 'Back view'][lightboxIndex]} · {lightboxIndex + 1}/{resultImages.length}
            <span className="block text-[11px] font-normal text-white/50 mt-0.5">Click image to {zoomed ? 'zoom out' : 'zoom in'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
