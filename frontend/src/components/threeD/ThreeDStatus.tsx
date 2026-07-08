import React from 'react';
import ThreeDLoading from './ThreeDLoading';
import ThreeDPlaceholder from './ThreeDPlaceholder';

interface Props {
  status: 'none' | 'processing' | 'ready' | 'failed';
  progress?: number;
  onViewClick?: () => void;
}

export default function ThreeDStatus({ status, progress = 0, onViewClick }: Props) {
  switch (status) {
    case 'processing':
      return (
        <ThreeDLoading
          progress={progress}
          statusText="AI Engine Generating 3D Model..."
          estimatedWait="This process takes about 20–30 seconds. Feel free to browse details while we generate the model."
        />
      );

    case 'failed':
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-red-50 border border-red-200 rounded-3xl min-h-[300px] select-none">
          <div className="w-16 h-16 rounded-2xl bg-white border border-red-150 flex items-center justify-center text-red-500 mb-4 shadow-sm">
            <svg
              className="w-8 h-8 stroke-1.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <h4 className="text-sm font-semibold text-red-800 mb-1">
            Generation Failed
          </h4>
          <p className="text-xs text-red-650/80 max-w-xs mb-6">
            The 3D model generation process failed. This can happen due to low image contrast, overlapping details, or resource constraints.
          </p>
          {onViewClick ? (
            <button
              onClick={onViewClick}
              className="px-6 py-2.5 bg-red-650 hover:bg-red-700 text-white border border-red-700 text-xs font-bold rounded-2xl transition-all shadow-sm cursor-pointer uppercase tracking-wider"
            >
              Retry Generation
            </button>
          ) : (
            <button
              disabled
              className="px-6 py-2.5 bg-red-100 border border-red-200 text-red-400 text-xs font-bold rounded-2xl cursor-not-allowed uppercase tracking-wider"
            >
              Failed
            </button>
          )}
        </div>
      );

    case 'none':
    default:
      return (
        <ThreeDPlaceholder
          message="This product does not have a 3D model yet."
          onActionClick={onViewClick}
        />
      );
  }
}
