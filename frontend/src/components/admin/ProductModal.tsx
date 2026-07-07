'use client';

import { useState, FormEvent, useEffect, useRef } from 'react';
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

interface Props {
  product: Product | null;
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

export default function ProductModal({ product, categories, onClose, onSaved }: Props) {
  const isEditing = product !== null;

  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product ? String(product.price / 100) : '');
  const [compareAtPrice, setCompareAtPrice] = useState(
    product?.compareAtPrice ? String(product.compareAtPrice / 100) : ''
  );
  const [categoryId, setCategoryId] = useState(
    typeof product?.category === 'object' ? product.category._id : (product?.category ?? '')
  );
  const [stock, setStock] = useState(String(product?.stock ?? '0'));
  const [existingImage, setExistingImage] = useState<{ url: string; publicId: string } | null>(
    product?.images[0] ?? null
  );
  const [newFile, setNewFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(product?.images[0]?.url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    let images: { url: string; publicId: string }[] = existingImage ? [existingImage] : [];

    if (newFile) {
      setUploading(true);
      const signRes = await api.post<UploadSignData>('/upload/sign', {});
      if (!signRes.success || !signRes.data) {
        setError('Failed to get upload credentials');
        setSaving(false);
        setUploading(false);
        return;
      }

      const uploaded = await uploadToCloudinary(newFile, signRes.data);
      setUploading(false);

      if (!uploaded) {
        setError('Image upload to Cloudinary failed');
        setSaving(false);
        return;
      }
      images = [uploaded];
    }

    const payload = {
      name: name.trim(),
      description: description.trim(),
      price: Math.round(parseFloat(price) * 100),
      compareAtPrice: compareAtPrice ? Math.round(parseFloat(compareAtPrice) * 100) : undefined,
      category: categoryId,
      stock: parseInt(stock, 10),
      images,
    };

    const res = isEditing
      ? await api.put<Product>(`/products/${product._id}`, payload)
      : await api.post<Product>('/products', payload);

    if (res.success) {
      onSaved();
    } else {
      setError(res.message ?? 'Save failed');
    }
    setSaving(false);
  }

  const inputClass =
    'block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">
          {isEditing ? 'Edit Product' : 'New Product'}
        </h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Product Image
            </label>
            {preview && (
              <div className="relative w-full h-48 rounded-lg overflow-hidden border border-gray-200 mb-2">
                <Image src={preview} alt="Preview" fill className="object-cover" unoptimized={preview.startsWith('blob:')} />
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full py-2 px-4 rounded-lg border border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
            >
              {preview ? 'Replace image' : 'Upload image'}
            </button>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="prod-name" className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
            <input id="prod-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Product name" />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="prod-desc" className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea id="prod-desc" rows={3} required value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} resize-none`} placeholder="Product description" />
          </div>

          {/* Price row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prod-price" className="block text-sm font-medium text-gray-700 mb-1.5">Price (USD)</label>
              <input id="prod-price" type="number" step="0.01" min="0" required value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} placeholder="0.00" />
            </div>
            <div>
              <label htmlFor="prod-compare" className="block text-sm font-medium text-gray-700 mb-1.5">
                Compare at <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input id="prod-compare" type="number" step="0.01" min="0" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} className={inputClass} placeholder="0.00" />
            </div>
          </div>

          {/* Category + Stock */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prod-cat" className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
              <select id="prod-cat" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="prod-stock" className="block text-sm font-medium text-gray-700 mb-1.5">Stock</label>
              <input id="prod-stock" type="number" min="0" step="1" required value={stock} onChange={(e) => setStock(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 px-4 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? 'Uploading…' : saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
