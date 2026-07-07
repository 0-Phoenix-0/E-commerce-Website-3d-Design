'use client';

import { useState, FormEvent, useEffect } from 'react';
import { api } from '@/lib/api';
import type { Category } from '@/types';

interface Props {
  category: Category | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function CategoryModal({ category, onClose, onSaved }: Props) {
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    if (category) {
      const payload = { name: name.trim(), description: description.trim() };
      const res = await api.put<Category>(`/categories/${category._id}`, payload);
      if (res.success) {
        onSaved();
      } else {
        setError(res.message ?? 'Save failed');
      }
    } else {
      const names = name.split(',').map(n => n.trim()).filter(Boolean);
      if (names.length === 0) {
        setError('Name is required');
        setSaving(false);
        return;
      }

      const errors: string[] = [];
      for (const n of names) {
        const payload = { name: n, description: description.trim() };
        const res = await api.post<Category>('/categories', payload);
        if (!res.success) {
          errors.push(`Failed to add "${n}": ${res.message ?? 'Unknown error'}`);
        }
      }

      if (errors.length > 0) {
        setError(errors.join(' | '));
      } else {
        onSaved();
      }
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">
          {category ? 'Edit Category' : 'New Category'}
        </h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="cat-name" className="block text-sm font-medium text-gray-700 mb-1.5">
              {category ? 'Name' : 'Name (comma-separated for multiple)'}
            </label>
            <input
              id="cat-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
              placeholder={category ? "e.g. Running Shoes" : "e.g. Running Shoes, T-Shirts, Hats"}
            />
          </div>

          <div>
            <label htmlFor="cat-desc" className="block text-sm font-medium text-gray-700 mb-1.5">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="cat-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors resize-none"
              placeholder="Brief description of this category"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 px-4 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
