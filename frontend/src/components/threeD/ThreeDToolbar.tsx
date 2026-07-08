import React from 'react';

interface Props {
  wireframe: boolean;
  onToggleWireframe: () => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  bgColor: string;
  onChangeBgColor: (color: string) => void;
  lightIntensity: number; // 0 to 2
  onChangeLightIntensity: (val: number) => void;
  onResetCamera: () => void;
  onScreenshot: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
}

export default function ThreeDToolbar({
  wireframe,
  onToggleWireframe,
  autoRotate,
  onToggleAutoRotate,
  bgColor,
  onChangeBgColor,
  lightIntensity,
  onChangeLightIntensity,
  onResetCamera,
  onScreenshot,
  onToggleFullscreen,
  isFullscreen,
}: Props) {
  return (
    <div className="absolute bottom-4 inset-x-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-950/80 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 text-white z-20 shadow-xl select-none text-xs">
      
      {/* View Options Group */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Wireframe Button */}
        <button
          type="button"
          onClick={onToggleWireframe}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
            wireframe
              ? 'bg-indigo-600 border-indigo-500 font-bold'
              : 'border-white/10 bg-white/5 hover:bg-white/10'
          }`}
          title="Toggle Wireframe View"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5" />
          </svg>
          Wireframe
        </button>

        {/* Auto Rotate Button */}
        <button
          type="button"
          onClick={onToggleAutoRotate}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
            autoRotate
              ? 'bg-indigo-600 border-indigo-500 font-bold'
              : 'border-white/10 bg-white/5 hover:bg-white/10'
          }`}
          title="Toggle Auto Rotation"
        >
          <svg className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Auto Rotate
        </button>

        {/* Background Color Picker */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-white/10 bg-white/5">
          <span className="text-[10px] text-gray-400 font-medium">BG</span>
          <div className="flex gap-1.5">
            {['#f3f4f6', '#111827', '#ffffff', '#2563eb'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChangeBgColor(c)}
                className={`w-4 h-4 rounded-full border transition-transform hover:scale-110 ${
                  bgColor.toLowerCase() === c.toLowerCase()
                    ? 'border-indigo-400 ring-1 ring-indigo-400 scale-105'
                    : 'border-white/20'
                }`}
                style={{ backgroundColor: c }}
                title={`Change background to ${c}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Lighting & Utility Group */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Lighting Control Range */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-white/10 bg-white/5">
          <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">Lighting</span>
          <input
            type="range"
            min="0.2"
            max="2.0"
            step="0.1"
            value={lightIntensity}
            onChange={(e) => onChangeLightIntensity(parseFloat(e.target.value))}
            className="w-16 accent-indigo-500 h-1 rounded-lg cursor-pointer bg-white/20 border-none outline-none"
            title="Adjust Lighting Intensity"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Reset Camera */}
          <button
            type="button"
            onClick={onResetCamera}
            className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
            title="Reset Camera View"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.228 14.307a6 6 0 01-11.479-2.174 6 6 0 1111.478 2.174zm0 0a3 3 0 11-5.714 0" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0l-1.5-1.5M12 12l1.5-1.5" />
            </svg>
          </button>

          {/* Screenshot */}
          <button
            type="button"
            onClick={onScreenshot}
            className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
            title="Capture Screenshot"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3 3m12 6V4.5m0 4.5h4.5m-4.5 0l6-6M9 15v4.5M9 15H4.5m4.5 0l-6 6m6-6v4.5m0-4.5h4.5m-4.5 0l6 6" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9M20.25 20.25v-4.5m0 4.5h-4.5m4.5 0l-5-5" />
              </svg>
            )}
          </button>
        </div>
      </div>
      
    </div>
  );
}
