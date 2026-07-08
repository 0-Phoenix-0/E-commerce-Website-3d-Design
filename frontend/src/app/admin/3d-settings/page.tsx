'use client';

import React from 'react';

export default function ThreeDSettingsPage() {
  const inputClass =
    'block w-full rounded-xl border border-gray-250 bg-gray-50 px-4 py-3 text-sm text-gray-500 cursor-not-allowed focus:outline-none transition-colors select-none';

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
          Infrastructure Configuration
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">3D Models Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure default AI generation parameters, storage targets, and processing workers for the Hunyuan3D model generator.
        </p>
      </div>

      <div className="space-y-6">
        {/* Core Generator Config Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.99l1.005.831a1.125 1.125 0 01.26 1.43l-1.297 2.247a1.125 1.125 0 01-1.37.491l-1.216-.456c-.356-.133-.751-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.831a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.645-.869l.214-1.28z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Model Generation Settings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Default Engine */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Default Engine</label>
              <select disabled className={inputClass}>
                <option>Hunyuan3D-1.0 (Default)</option>
                <option>Hunyuan3D-2.0-preview</option>
                <option>TripoSR-1.1</option>
              </select>
              <span className="text-[10px] text-gray-400 mt-1 block">AI model engine that will generate GLB files.</span>
            </div>

            {/* Generation Quality */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Generation Quality</label>
              <select disabled className={inputClass}>
                <option>Standard (Fast, ~15s)</option>
                <option>High (Detailed, ~45s)</option>
                <option>Ultra (Strict textures, ~120s)</option>
              </select>
              <span className="text-[10px] text-gray-400 mt-1 block">Controls resolution, geometric density, and textures.</span>
            </div>

            {/* Auto Generate Toggle */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-4 md:col-span-2">
              <div>
                <span className="text-sm font-semibold text-gray-800 block">Auto-generate 3D model on product creation</span>
                <span className="text-xs text-gray-400 block mt-0.5">When checked, adding new products automatically triggers the generation queue.</span>
              </div>
              <input
                disabled
                type="checkbox"
                checked={false}
                readOnly
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-0 cursor-not-allowed opacity-50"
              />
            </div>

          </div>
        </div>

        {/* Storage and Queue Config Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 6c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
            </svg>
            Storage & Worker Queue
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Storage Path */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Storage Path / Directory</label>
              <input
                disabled
                type="text"
                placeholder="/cloudinary/3d-models/"
                className={inputClass}
              />
              <span className="text-[10px] text-gray-400 mt-1 block">Cloudinary or local CDN folder path target for assets.</span>
            </div>

            {/* Worker Count */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Worker Count</label>
              <input
                disabled
                type="number"
                placeholder="4"
                className={inputClass}
              />
              <span className="text-[10px] text-gray-400 mt-1 block">Parallel generation background threads (concurrency).</span>
            </div>

          </div>
        </div>

        {/* Worker GPU Status Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21M6.75 6.75h10.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25H6.75a2.25 2.25 0 01-2.25-2.25V9a2.25 2.25 0 012.25-2.25z" />
            </svg>
            GPU Hardware Status
          </h2>
          
          <div className="flex flex-col md:flex-row items-center gap-4 bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs font-medium text-gray-500">
            <div className="flex items-center gap-2 text-red-500 shrink-0 select-none">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span>Offline / Uninstalled</span>
            </div>
            <div className="border-l border-gray-200 h-6 hidden md:block" />
            <div>
              GPU Worker cluster was not detected on the environment path. AI engine must be installed and linked in workers environment configurations to activate 3D model generation processes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
