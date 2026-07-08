import React from 'react';

interface Props {
  className?: string;
  size?: 'sm' | 'md';
}

export default function ThreeDBadge({ className = '', size = 'sm' }: Props) {
  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[9px] gap-1'
      : 'px-3 py-1 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-extrabold uppercase tracking-wider rounded-full shadow-sm text-white bg-gradient-to-r from-indigo-600 to-violet-600 border border-indigo-500/25 select-none ${sizeClasses} ${className}`}
    >
      <svg
        className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
        />
      </svg>
      <span>3D Available</span>
    </span>
  );
}
