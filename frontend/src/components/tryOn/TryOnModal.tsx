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

  const busy = step === 'uploading' || step === 'generating';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/35 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 text-left">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-lg font-bold text-gray-900">Try It On Yourself</h3>
          <button
            onClick={() => !busy && onClose()}
            disabled={busy}
            aria-label="Close"
            className="p-1 text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-40"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-5">
          Upload a photo of yourself and our AI will show you wearing{' '}
          <span className="font-semibold text-gray-700">{product.name}</span>.
        </p>

        {/* Step: pick photo */}
        {(step === 'pick' || step === 'error') && (
          <div className="space-y-4">
            {errorMessage && (
              <div className="rounded-xl px-4 py-3 text-sm font-semibold bg-red-50 border border-red-200 text-red-700">
                {errorMessage}
              </div>
            )}

            {photo ? (
              <div className="relative aspect-3/4 rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
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
              <label className="flex flex-col items-center justify-center gap-2 aspect-3/4 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors cursor-pointer select-none bg-gray-50/50">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.25} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0" />
                </svg>
                <span className="text-sm font-bold">Upload your photo</span>
                <span className="text-[11px] text-gray-400 px-8 text-center">
                  A full-body, front-facing photo with good lighting works best
                </span>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/avif" className="hidden" onChange={handleFileChange} />
              </label>
            )}

            <button
              onClick={handleGenerate}
              disabled={!photo}
              className="w-full py-3 bg-gray-950 hover:bg-gray-900 text-white text-sm font-bold rounded-2xl transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ✨ Generate My Try-On
            </button>
            <p className="text-[10px] text-gray-400 text-center">
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
            <div className="grid grid-cols-3 gap-3">
              {resultImages.map((url, idx) => (
                <div key={url} className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                  {/* Claid result URLs are temporary external links — plain img avoids next/image domain config */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`${['Front view', 'Side view', 'Back view'][idx]}`} className="w-full h-auto" />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 text-center">Front • Side • Back</p>
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
  );
}
