import React from 'react';

interface Props {
  progress?: number; // 0 to 100
  statusText?: string;
  estimatedWait?: string;
}

export default function ThreeDLoading({
  progress = 0,
  statusText = 'Loading 3D asset...',
  estimatedWait = 'This will take about 10–20 seconds.',
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50 border border-gray-150 rounded-3xl min-h-[300px] select-none">
      {/* Outer spinning ring, inner pulsing core */}
      <div className="relative w-16 h-16 mb-5 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-indigo-100 border-t-indigo-600 animate-spin" />
        <svg
          className="w-6 h-6 text-indigo-600 animate-pulse"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
          />
        </svg>
      </div>

      <h4 className="text-sm font-semibold text-gray-800 mb-1">
        {statusText}
      </h4>
      <p className="text-xs text-gray-400 max-w-xs mb-5">
        {estimatedWait}
      </p>

      {/* Progress Bar Container */}
      <div className="w-48 bg-gray-200 h-1.5 rounded-full overflow-hidden relative shadow-inner">
        <div
          className="bg-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>

      <span className="text-[10px] text-gray-400 font-bold mt-2 tracking-wider">
        {Math.round(progress)}% LOADED
      </span>
    </div>
  );
}
