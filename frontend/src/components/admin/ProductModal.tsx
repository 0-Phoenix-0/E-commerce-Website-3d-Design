'use client';

import { useState, FormEvent, useEffect, useRef } from 'react';
import Image from 'next/image';
import { api } from '@/lib/api';
import type { Category, Product, ProductReview } from '@/types';

interface UploadSignData {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
}

interface MediaItem {
  url?: string;
  publicId?: string;
  type: 'image' | 'video';
  file?: File;
  preview: string;
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
): Promise<{ url: string; publicId: string; type: 'image' | 'video' } | null> {
  const isVideo = file.type.startsWith('video/');
  const resourceType = isVideo ? 'video' : 'image';

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sign.apiKey);
  form.append('timestamp', String(sign.timestamp));
  form.append('signature', sign.signature);
  form.append('folder', sign.folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sign.cloudName}/${resourceType}/upload`,
    { method: 'POST', body: form }
  );

  if (!res.ok) return null;
  const data = (await res.json()) as { secure_url: string; public_id: string };
  return { url: data.secure_url, publicId: data.public_id, type: resourceType };
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
  
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(
    product?.images?.map((img) => ({
      url: img.url,
      publicId: img.publicId,
      type: img.type || 'image',
      preview: img.url,
    })) ?? []
  );

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New attributes state hooks
  const [brand, setBrand] = useState(product?.brand ?? '');
  const [rating, setRating] = useState(product ? String(product.rating ?? '0') : '0');
  const [discountPercentage, setDiscountPercentage] = useState(product?.discountPercentage ? String(product.discountPercentage) : '');
  const [tags, setTags] = useState(product?.tags ? product.tags.join(', ') : '');
  const [availabilityStatus, setAvailabilityStatus] = useState(product?.availabilityStatus ?? 'In Stock');
  const [shippingInformation, setShippingInformation] = useState(product?.shippingInformation ?? '');
  const [returnPolicy, setReturnPolicy] = useState(product?.returnPolicy ?? '');
  const [warrantyInformation, setWarrantyInformation] = useState(product?.warrantyInformation ?? '');
  const [minimumOrderQuantity, setMinimumOrderQuantity] = useState(product ? String(product.minimumOrderQuantity ?? '1') : '1');
  const [reviews, setReviews] = useState<ProductReview[]>(product?.reviews ?? []);

  // Badge States
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [bestSeller, setBestSeller] = useState(product?.bestSeller ?? false);
  const [trending, setTrending] = useState(product?.trending ?? false);
  const [newArrival, setNewArrival] = useState(product?.newArrival ?? false);
  const [onSale, setOnSale] = useState(product?.onSale ?? false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function moveMedia(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= mediaItems.length) return;
    const items = [...mediaItems];
    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;
    setMediaItems(items);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    let images: { url: string; publicId: string; type: 'image' | 'video' }[] = [];

    const hasFiles = mediaItems.some((item) => !!item.file);
    let signData: UploadSignData | null = null;
    if (hasFiles) {
      setUploading(true);
      const signRes = await api.post<UploadSignData>('/upload/sign', {});
      if (!signRes.success || !signRes.data) {
        setError('Failed to get upload credentials');
        setSaving(false);
        setUploading(false);
        return;
      }
      signData = signRes.data;
    }

    for (const item of mediaItems) {
      if (item.file) {
        if (!signData) {
          setError('Signature data missing');
          setSaving(false);
          setUploading(false);
          return;
        }
        const uploaded = await uploadToCloudinary(item.file, signData);
        if (!uploaded) {
          setError('Some uploads failed');
          setSaving(false);
          setUploading(false);
          return;
        }
        images.push({
          url: uploaded.url,
          publicId: uploaded.publicId,
          type: uploaded.type,
        });
      } else if (item.url && item.publicId) {
        images.push({
          url: item.url,
          publicId: item.publicId,
          type: item.type,
        });
      }
    }
    setUploading(false);

    const payload = {
      name: name.trim(),
      description: description.trim(),
      price: Math.round(parseFloat(price) * 100),
      compareAtPrice: compareAtPrice ? Math.round(parseFloat(compareAtPrice) * 100) : null,
      category: categoryId,
      stock: parseInt(stock, 10),
      images,
      brand: brand.trim() || null,
      rating: rating ? parseFloat(rating) : 0,
      discountPercentage: discountPercentage ? parseFloat(discountPercentage) : null,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      availabilityStatus: availabilityStatus.trim() || null,
      shippingInformation: shippingInformation.trim() || null,
      returnPolicy: returnPolicy.trim() || null,
      warrantyInformation: warrantyInformation.trim() || null,
      minimumOrderQuantity: minimumOrderQuantity ? parseInt(minimumOrderQuantity, 10) : 1,
      reviews,
      featured,
      bestSeller,
      trending,
      newArrival,
      onSale,
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
          {/* Media Items */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 font-semibold">
              Product Media (Images & Videos)
            </label>
            {mediaItems.length > 0 ? (
              <div className="grid grid-cols-3 gap-3 mb-3">
                {mediaItems.map((item, idx) => {
                  const isVideo = item.type === 'video';
                  return (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group bg-gray-50 flex flex-col justify-between">
                      {isVideo ? (
                        <video src={item.preview} className="w-full h-full object-cover pointer-events-none" muted />
                      ) : (
                        <div className="relative w-full h-full">
                          <Image src={item.preview} alt="" fill className="object-cover" unoptimized={item.preview.startsWith('blob:')} />
                        </div>
                      )}
                      
                      <span className="absolute top-1 left-1 text-[8px] font-bold px-1 py-0.5 rounded bg-black/60 text-white uppercase tracking-wider">
                        {item.type}
                      </span>
                      
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveMedia(idx, 'up')}
                          className="p-1 rounded bg-white text-gray-800 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                          title="Move Left"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          disabled={idx === mediaItems.length - 1}
                          onClick={() => moveMedia(idx, 'down')}
                          className="p-1 rounded bg-white text-gray-800 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                          title="Move Right"
                        >
                          →
                        </button>
                        <button
                          type="button"
                          onClick={() => setMediaItems(mediaItems.filter((_, i) => i !== idx))}
                          className="p-1 rounded bg-red-650 text-white hover:bg-red-700 transition-colors"
                          title="Remove"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic mb-2">No media files uploaded yet.</p>
            )}
            
            <div className="flex gap-2">
              <label className="flex-1 flex flex-col items-center justify-center py-2 px-3 rounded-lg border border-dashed border-gray-305 text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors cursor-pointer">
                <span>➕ Add Images</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const newItems = files.map((file) => ({
                      file,
                      preview: URL.createObjectURL(file),
                      type: 'image' as const,
                    }));
                    setMediaItems((prev) => [...prev, ...newItems]);
                  }}
                />
              </label>
              
              <label className="flex-1 flex flex-col items-center justify-center py-2 px-3 rounded-lg border border-dashed border-gray-305 text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors cursor-pointer">
                <span>➕ Add Videos</span>
                <input
                  type="file"
                  accept="video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const newItems = files.map((file) => ({
                      file,
                      preview: URL.createObjectURL(file),
                      type: 'video' as const,
                    }));
                    setMediaItems((prev) => [...prev, ...newItems]);
                  }}
                />
              </label>
            </div>
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

          {/* Brand + Rating */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prod-brand" className="block text-sm font-medium text-gray-700 mb-1.5">Brand</label>
              <input id="prod-brand" type="text" value={brand} onChange={(e) => setBrand(e.target.value)} className={inputClass} placeholder="e.g. Nike" />
            </div>
            <div>
              <label htmlFor="prod-rating" className="block text-sm font-medium text-gray-700 mb-1.5">Rating (0-5)</label>
              <input id="prod-rating" type="number" step="0.1" min="0" max="5" value={rating} onChange={(e) => setRating(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Discount + MOQ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prod-discount" className="block text-sm font-medium text-gray-700 mb-1.5">Discount %</label>
              <input id="prod-discount" type="number" min="0" max="100" step="0.1" value={discountPercentage} onChange={(e) => setDiscountPercentage(e.target.value)} className={inputClass} placeholder="e.g. 10" />
            </div>
            <div>
              <label htmlFor="prod-moq" className="block text-sm font-medium text-gray-700 mb-1.5">Min. Order Qty</label>
              <input id="prod-moq" type="number" min="1" step="1" value={minimumOrderQuantity} onChange={(e) => setMinimumOrderQuantity(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Availability Status + Tags */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prod-avail" className="block text-sm font-medium text-gray-700 mb-1.5">Availability Status</label>
              <select id="prod-avail" value={availabilityStatus} onChange={(e) => setAvailabilityStatus(e.target.value)} className={inputClass}>
                <option value="In Stock">In Stock</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Out of Stock">Out of Stock</option>
                <option value="Discontinued">Discontinued</option>
              </select>
            </div>
            <div>
              <label htmlFor="prod-tags" className="block text-sm font-medium text-gray-700 mb-1.5">
                Tags <span className="text-gray-400 font-normal">(comma-separated)</span>
              </label>
              <input id="prod-tags" type="text" value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} placeholder="e.g. shoes, running" />
            </div>
          </div>

          {/* Shipping + Returns */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prod-shipping" className="block text-sm font-medium text-gray-700 mb-1.5">Shipping Information</label>
              <input id="prod-shipping" type="text" value={shippingInformation} onChange={(e) => setShippingInformation(e.target.value)} className={inputClass} placeholder="e.g. Ships in 1-2 business days" />
            </div>
            <div>
              <label htmlFor="prod-returns" className="block text-sm font-medium text-gray-700 mb-1.5">Return Policy</label>
              <input id="prod-returns" type="text" value={returnPolicy} onChange={(e) => setReturnPolicy(e.target.value)} className={inputClass} placeholder="e.g. 30 days return policy" />
            </div>
          </div>

          {/* Warranty */}
          <div>
            <label htmlFor="prod-warranty" className="block text-sm font-medium text-gray-700 mb-1.5">Warranty Information</label>
            <input id="prod-warranty" type="text" value={warrantyInformation} onChange={(e) => setWarrantyInformation(e.target.value)} className={inputClass} placeholder="e.g. 1 year warranty" />
          </div>

          {/* Badges Checklist */}
          <div className="border-t border-gray-100 pt-4 mt-2">
            <label className="block text-sm font-semibold text-gray-800 mb-2">Product Badges</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Featured', value: featured, setValue: setFeatured },
                { label: 'Best Seller', value: bestSeller, setValue: setBestSeller },
                { label: 'Trending', value: trending, setValue: setTrending },
                { label: 'New Arrival', value: newArrival, setValue: setNewArrival },
                { label: 'On Sale', value: onSale, setValue: setOnSale },
              ].map((badge) => (
                <label key={badge.label} className="flex items-center gap-2 text-xs font-semibold text-gray-750 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={badge.value}
                    onChange={(e) => badge.setValue(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  {badge.label}
                </label>
              ))}
            </div>
          </div>

          {/* Reviews List & Editing Section */}
          <div className="border-t border-gray-100 pt-4 mt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-800">Customer Reviews ({reviews.length})</label>
              <button
                type="button"
                onClick={() => {
                  setReviews([
                    ...reviews,
                    {
                      reviewerName: '',
                      rating: 5,
                      comment: '',
                      date: new Date().toISOString(),
                    },
                  ]);
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-750 transition-colors"
              >
                + Add Review
              </button>
            </div>
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              {reviews.map((rev, idx) => (
                <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-xl relative space-y-2">
                  <button
                    type="button"
                    onClick={() => setReviews(reviews.filter((_, i) => i !== idx))}
                    className="absolute top-2.5 right-2.5 text-xs font-bold text-red-650 hover:text-red-755 transition-colors"
                  >
                    Remove
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Reviewer Name"
                      value={rev.reviewerName}
                      onChange={(e) => {
                        const updated = [...reviews];
                        updated[idx].reviewerName = e.target.value;
                        setReviews(updated);
                      }}
                      className="block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-800"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Rating (1-5)"
                      min="1"
                      max="5"
                      value={rev.rating}
                      onChange={(e) => {
                        const updated = [...reviews];
                        updated[idx].rating = parseInt(e.target.value, 10) || 5;
                        setReviews(updated);
                      }}
                      className="block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-800"
                      required
                    />
                  </div>
                  <textarea
                    placeholder="Comment"
                    rows={2}
                    value={rev.comment}
                    onChange={(e) => {
                      const updated = [...reviews];
                      updated[idx].comment = e.target.value;
                      setReviews(updated);
                    }}
                    className="block w-full rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-850 resize-none"
                    required
                  />
                </div>
              ))}
              {reviews.length === 0 && (
                <p className="text-xs text-gray-400 italic">No reviews for this product yet.</p>
              )}
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
