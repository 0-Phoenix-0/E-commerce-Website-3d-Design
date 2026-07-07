'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { api } from '@/lib/api';
import type { Category, Product } from '@/types';

interface UploadSignData {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
}

interface BulkRow {
  id: string;
  name: string;
  description: string;
  price: string;
  compareAtPrice: string;
  categoryId: string;
  stock: string;
  imageFile: File | null;
  imagePreview: string | null;
}

interface Props {
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

async function uploadToCloudinary(
  file: File,
  sign: UploadSignData
): Promise<{ url: string; publicId: string } | null> {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sign.apiKey);
  form.append('timestamp', String(sign.timestamp));
  form.append('signature', sign.signature);
  form.append('folder', sign.folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`,
    { method: 'POST', body: form }
  );

  if (!res.ok) return null;
  const data = (await res.json()) as { secure_url: string; public_id: string };
  return { url: data.secure_url, publicId: data.public_id };
}

export default function BulkProductModal({ categories, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<BulkRow[]>([
    {
      id: '1',
      name: '',
      description: '',
      price: '',
      compareAtPrice: '',
      categoryId: '',
      stock: '0',
      imageFile: null,
      imagePreview: null,
    },
  ]);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function addRow() {
    if (rows.length >= 20) return;
    setRows([
      ...rows,
      {
        id: String(Date.now()),
        name: '',
        description: '',
        price: '',
        compareAtPrice: '',
        categoryId: '',
        stock: '0',
        imageFile: null,
        imagePreview: null,
      },
    ]);
  }

  function removeRow(id: string) {
    if (rows.length === 1) return;
    setRows(rows.filter((r) => r.id !== id));
  }

  function updateRow(id: string, fields: Partial<BulkRow>) {
    setRows(rows.map((r) => (r.id === id ? { ...r, ...fields } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    // Validation
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.name.trim()) {
        setError(`Row ${i + 1}: Name is required`);
        setSaving(false);
        return;
      }
      if (!r.description.trim()) {
        setError(`Row ${i + 1}: Description is required`);
        setSaving(false);
        return;
      }
      if (!r.price || isNaN(parseFloat(r.price)) || parseFloat(r.price) < 0) {
        setError(`Row ${i + 1}: Valid Price is required`);
        setSaving(false);
        return;
      }
      if (!r.categoryId) {
        setError(`Row ${i + 1}: Category is required`);
        setSaving(false);
        return;
      }
      if (!r.stock || isNaN(parseInt(r.stock, 10)) || parseInt(r.stock, 10) < 0) {
        setError(`Row ${i + 1}: Valid Stock level is required`);
        setSaving(false);
        return;
      }
    }

    try {
      // Get signature if any rows have images
      const hasImages = rows.some((r) => r.imageFile !== null);
      let signData: UploadSignData | null = null;

      if (hasImages) {
        setStatusMessage('Requesting upload signature…');
        const signRes = await api.post<UploadSignData>('/upload/sign', {});
        if (!signRes.success || !signRes.data) {
          setError('Failed to fetch image upload signature.');
          setSaving(false);
          return;
        }
        signData = signRes.data;
      }

      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        let images: { url: string; publicId: string }[] = [];

        if (r.imageFile && signData) {
          setStatusMessage(`Uploading image for "${r.name}" (${i + 1}/${rows.length})…`);
          const uploaded = await uploadToCloudinary(r.imageFile, signData);
          if (uploaded) {
            images = [uploaded];
          } else {
            errors.push(`Failed to upload image for "${r.name}"`);
            continue;
          }
        }

        setStatusMessage(`Creating product "${r.name}" (${i + 1}/${rows.length})…`);
        const payload = {
          name: r.name.trim(),
          description: r.description.trim(),
          price: Math.round(parseFloat(r.price) * 100),
          compareAtPrice: r.compareAtPrice ? Math.round(parseFloat(r.compareAtPrice) * 100) : undefined,
          category: r.categoryId,
          stock: parseInt(r.stock, 10),
          images,
        };

        const res = await api.post<Product>('/products', payload);
        if (!res.success) {
          errors.push(`Failed to save "${r.name}": ${res.message ?? 'Unknown error'}`);
        }
      }

      if (errors.length > 0) {
        setError(errors.join(' | '));
      } else {
        onSaved();
      }
    } catch (err: any) {
      setError(err.message ?? 'An unexpected error occurred.');
    } finally {
      setSaving(false);
      setStatusMessage('');
    }
  }

  const inputClass =
    'block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Add Multiple Products</h2>
            <p className="text-xs text-gray-500 mt-0.5">Add up to 20 products at once in tabular format.</p>
          </div>
          <div className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
            {rows.length} / 20 Products
          </div>
        </div>

        {/* Error / Status info */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 max-h-24 overflow-y-auto">
            {error}
          </div>
        )}

        {saving && statusMessage && (
          <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200 px-4 py-3 rounded-lg text-xs text-blue-700 font-medium">
            <svg className="animate-spin h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {statusMessage}
          </div>
        )}

        {/* Tabular Form Container */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto border border-gray-200 rounded-xl mb-4 bg-gray-50/50">
            <table className="min-w-full divide-y divide-gray-200 table-fixed">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="w-24 px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Image</th>
                  <th className="w-56 px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Name *</th>
                  <th className="w-72 px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Description *</th>
                  <th className="w-32 px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Price (USD) *</th>
                  <th className="w-32 px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Compare At</th>
                  <th className="w-44 px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Category *</th>
                  <th className="w-28 px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Stock *</th>
                  <th className="w-16 px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {rows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-gray-50/70 transition-colors">
                    
                    {/* Image Upload/Preview */}
                    <td className="px-3 py-3 align-top">
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 transition-colors group">
                        {row.imagePreview ? (
                          <div className="relative w-full h-full">
                            <Image src={row.imagePreview} alt="Preview" fill className="object-cover" unoptimized />
                          </div>
                        ) : (
                          <svg className="w-6 h-6 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              updateRow(row.id, {
                                imageFile: file,
                                imagePreview: URL.createObjectURL(file),
                              });
                            }
                          }}
                        />
                      </div>
                    </td>

                    {/* Name */}
                    <td className="px-3 py-3 align-top">
                      <input
                        type="text"
                        required
                        value={row.name}
                        onChange={(e) => updateRow(row.id, { name: e.target.value })}
                        className={inputClass}
                        placeholder="Product Name"
                      />
                    </td>

                    {/* Description */}
                    <td className="px-3 py-3 align-top">
                      <textarea
                        rows={2}
                        required
                        value={row.description}
                        onChange={(e) => updateRow(row.id, { description: e.target.value })}
                        className={`${inputClass} resize-none`}
                        placeholder="Product Description"
                      />
                    </td>

                    {/* Price */}
                    <td className="px-3 py-3 align-top">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={row.price}
                        onChange={(e) => updateRow(row.id, { price: e.target.value })}
                        className={inputClass}
                        placeholder="0.00"
                      />
                    </td>

                    {/* Compare At Price */}
                    <td className="px-3 py-3 align-top">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.compareAtPrice}
                        onChange={(e) => updateRow(row.id, { compareAtPrice: e.target.value })}
                        className={inputClass}
                        placeholder="0.00"
                      />
                    </td>

                    {/* Category */}
                    <td className="px-3 py-3 align-top">
                      <select
                        required
                        value={row.categoryId}
                        onChange={(e) => updateRow(row.id, { categoryId: e.target.value })}
                        className={inputClass}
                      >
                        <option value="">Select Category</option>
                        {categories.map((cat) => (
                          <option key={cat._id} value={cat._id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Stock */}
                    <td className="px-3 py-3 align-top">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={row.stock}
                        onChange={(e) => updateRow(row.id, { stock: e.target.value })}
                        className={inputClass}
                      />
                    </td>

                    {/* Remove row */}
                    <td className="px-3 py-3 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length === 1}
                        className="text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed p-1 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-gray-200 pt-4 gap-3">
            <button
              type="button"
              onClick={addRow}
              disabled={rows.length >= 20 || saving}
              className="flex items-center gap-2 py-2.5 px-4 rounded-lg border border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-sm font-semibold text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all w-full sm:w-auto justify-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Row
            </button>

            <div className="flex gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 sm:flex-none py-2.5 px-5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 sm:flex-none py-2.5 px-6 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {saving ? 'Saving…' : `Save ${rows.length} Products`}
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}
