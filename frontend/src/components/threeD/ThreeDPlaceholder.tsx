import React from 'react';

interface Props {
  message?: string;
  onActionClick?: () => void;
}

export default function ThreeDPlaceholder({
  message = 'This product does not have a 3D model yet.',
  onActionClick,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50 border border-dashed border-gray-200 rounded-3xl min-h-[300px] select-none">
      {/* 3D Wireframe Cube Icon */}
      <div className="w-16 h-16 rounded-2xl bg-white border border-gray-150 flex items-center justify-center text-gray-400 mb-4 shadow-sm">
        <svg
          className="w-8 h-8 text-gray-400 stroke-1"
          fill="none"
          stroke="currentColor"
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
        3D Model Unavailable
      </h4>
      <p className="text-xs text-gray-400 max-w-xs mb-6">
        {message}
      </p>

      {onActionClick ? (
        <button
          onClick={onActionClick}
          className="px-6 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white border border-indigo-700 text-xs font-bold rounded-2xl transition-all shadow-sm cursor-pointer uppercase tracking-wider"
        >
          View in 3D
        </button>
      ) : (
        <button
          disabled
          className="px-6 py-2.5 bg-gray-100 border border-gray-200 text-gray-400 text-xs font-bold rounded-2xl transition-all shadow-sm cursor-not-allowed uppercase tracking-wider"
        >
          View in 3D
        </button>
      )}
    </div>
  );
}
