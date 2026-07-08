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

  // 3D Model States
  const [threeDEnabled, setThreeDEnabled] = useState(product?.threeD?.enabled ?? false);
  const [threeDStatus, setThreeDStatus] = useState<string>(product?.threeD?.status ?? 'none');
  const [threeDEngine, setThreeDEngine] = useState(product?.threeD?.engine ?? '');
  const [threeDVersion, setThreeDVersion] = useState(product?.threeD?.version ?? '');
  const [threeDModelUrl, setThreeDModelUrl] = useState(product?.threeD?.modelUrl ?? '');
  const [threeDThumbnailUrl, setThreeDThumbnailUrl] = useState(product?.threeD?.thumbnailUrl ?? '');
  const [threeDPreviewImage, setThreeDPreviewImage] = useState(product?.threeD?.previewImage ?? '');
  const [threeDGeneratedAt, setThreeDGeneratedAt] = useState<string | null>(product?.threeD?.generatedAt ? String(product.threeD.generatedAt) : null);
  const [threeDImageHash, setThreeDImageHash] = useState(product?.threeD?.imageHash ?? '');
  const [threeDGenerationTime, setThreeDGenerationTime] = useState(product?.threeD?.generationTime ? String(product.threeD.generationTime) : '');
  const [threeDFileSize, setThreeDFileSize] = useState(product?.threeD?.fileSize ? String(product.threeD.fileSize) : '');
  const [threeDGpuUsed, setThreeDGpuUsed] = useState(product?.threeD?.gpuUsed ?? '');
  const [threeDVramUsage, setThreeDVramUsage] = useState(product?.threeD?.vramUsage ? String(product.threeD.vramUsage) : '');
  const [threeDTextureResolution, setThreeDTextureResolution] = useState(product?.threeD?.textureResolution ?? '');
  const [threeDEstimatedTime, setThreeDEstimatedTime] = useState(product?.threeD?.estimatedTime ? String(product.threeD.estimatedTime) : '');
  const [threeDError, setThreeDError] = useState(product?.threeD?.error ?? '');
  const [threeDVertices, setThreeDVertices] = useState(product?.threeD?.meshStats?.vertices ? String(product.threeD.meshStats.vertices) : '');
  const [threeDFaces, setThreeDFaces] = useState(product?.threeD?.meshStats?.faces ? String(product.threeD.meshStats.faces) : '');

  const [generating, setGenerating] = useState(false);

  async function handleGenerate(force = false) {
    if (!product?._id) {
      alert("Please save/create the product first before triggering manual 3D generation.");
      return;
    }
    setGenerating(true);
    try {
      const res = await api.post<{ status: string }>(`/products/${product._id}/3d/generate`, { force });
      if (res.success) {
        setThreeDStatus('processing');
        setThreeDError('');
        alert(force ? 'Regeneration job queued.' : 'Generation job queued.');
      } else {
        alert('Failed: ' + res.message);
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleDeleteModel() {
    if (!product?._id) {
      setThreeDEnabled(false);
      setThreeDStatus('none');
      setThreeDEngine('');
      setThreeDVersion('');
      setThreeDModelUrl('');
      setThreeDThumbnailUrl('');
      setThreeDPreviewImage('');
      setThreeDGeneratedAt(null);
      setThreeDImageHash('');
      setThreeDGenerationTime('');
      setThreeDFileSize('');
      setThreeDGpuUsed('');
      setThreeDVramUsage('');
      setThreeDTextureResolution('');
      setThreeDEstimatedTime('');
      setThreeDError('');
      setThreeDVertices('');
      setThreeDFaces('');
      return;
    }
    
    if (!confirm('Are you sure you want to delete the 3D model and its metadata?')) return;
    try {
      const res = await api.delete(`/products/${product._id}/3d`);
      if (res.success) {
        setThreeDEnabled(false);
        setThreeDStatus('none');
        setThreeDEngine('');
        setThreeDVersion('');
        setThreeDModelUrl('');
        setThreeDThumbnailUrl('');
        setThreeDPreviewImage('');
        setThreeDGeneratedAt(null);
        setThreeDImageHash('');
        setThreeDGenerationTime('');
        setThreeDFileSize('');
        setThreeDGpuUsed('');
        setThreeDVramUsage('');
        setThreeDTextureResolution('');
        setThreeDEstimatedTime('');
        setThreeDError('');
        setThreeDVertices('');
        setThreeDFaces('');
      } else {
        alert('Failed to delete: ' + res.message);
      }
    } catch (err: any) {
      alert('Error deleting: ' + err.message);
    }
  }

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
      threeD: {
        enabled: threeDEnabled,
        status: threeDStatus,
        engine: threeDEngine.trim() || null,
        version: threeDVersion.trim() || null,
        modelUrl: threeDModelUrl.trim() || null,
        thumbnailUrl: threeDThumbnailUrl.trim() || null,
        previewImage: threeDPreviewImage.trim() || null,
        generatedAt: threeDGeneratedAt,
        imageHash: threeDImageHash.trim() || null,
        generationTime: threeDGenerationTime ? parseFloat(threeDGenerationTime) : null,
        fileSize: threeDFileSize ? parseInt(threeDFileSize, 10) : null,
        gpuUsed: threeDGpuUsed.trim() || null,
        vramUsage: threeDVramUsage ? parseFloat(threeDVramUsage) : null,
        textureResolution: threeDTextureResolution.trim() || null,
        estimatedTime: threeDEstimatedTime ? parseFloat(threeDEstimatedTime) : null,
        error: threeDError.trim() || null,
        meshStats: threeDVertices && threeDFaces ? {
          vertices: parseInt(threeDVertices, 10),
          faces: parseInt(threeDFaces, 10)
        } : null
      }
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

          {/* 3D Model Configuration Section */}
          <div className="border-t border-gray-100 pt-4 mt-2">
            <h3 className="block text-sm font-semibold text-gray-800 mb-3">3D Model Infrastructure</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
              
              {/* Enable checkbox & Status */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-750 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={threeDEnabled}
                    onChange={(e) => setThreeDEnabled(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  Enable 3D Model
                </label>
                <div>
                  <label htmlFor="threed-status" className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Current Status</label>
                  <select
                    id="threed-status"
                    value={threeDStatus}
                    onChange={(e) => setThreeDStatus(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none bg-white text-gray-800"
                  >
                    <option value="none">none</option>
                    <option value="processing">processing</option>
                    <option value="ready">ready</option>
                    <option value="failed">failed</option>
                  </select>
                </div>
              </div>

              {/* Engine & Version */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="threed-engine" className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Engine</label>
                  <input
                    id="threed-engine"
                    type="text"
                    placeholder="e.g. Hunyuan3D"
                    value={threeDEngine}
                    onChange={(e) => setThreeDEngine(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-2 py-1 text-xs bg-white text-gray-800"
                  />
                </div>
                <div>
                  <label htmlFor="threed-version" className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Version</label>
                  <input
                    id="threed-version"
                    type="text"
                    placeholder="e.g. v1.0"
                    value={threeDVersion}
                    onChange={(e) => setThreeDVersion(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-2 py-1 text-xs bg-white text-gray-800"
                  />
                </div>
              </div>

              {/* Model URL & Thumbnail URL */}
              <div className="space-y-2">
                <div>
                  <label htmlFor="threed-model-url" className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Model GLB URL</label>
                  <input
                    id="threed-model-url"
                    type="text"
                    placeholder="https://example.com/model.glb"
                    value={threeDModelUrl}
                    onChange={(e) => setThreeDModelUrl(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-2 py-1 text-xs bg-white text-gray-800"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="threed-thumb-url" className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Thumbnail URL</label>
                    <input
                      id="threed-thumb-url"
                      type="text"
                      placeholder="https://example.com/thumb.jpg"
                      value={threeDThumbnailUrl}
                      onChange={(e) => setThreeDThumbnailUrl(e.target.value)}
                      className="block w-full rounded-lg border border-gray-300 px-2 py-1 text-xs bg-white text-gray-800"
                    />
                  </div>
                  <div>
                    <label htmlFor="threed-preview-url" className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Preview Image URL</label>
                    <input
                      id="threed-preview-url"
                      type="text"
                      placeholder="https://example.com/preview.jpg"
                      value={threeDPreviewImage}
                      onChange={(e) => setThreeDPreviewImage(e.target.value)}
                      className="block w-full rounded-lg border border-gray-300 px-2 py-1 text-xs bg-white text-gray-800"
                    />
                  </div>
                </div>
              </div>
                     {/* Detailed Metrics Panel */}
              <div className="grid grid-cols-3 gap-x-2 gap-y-3 text-[10px] text-gray-550 bg-white p-3 rounded-lg border border-gray-150">
                <div>
                  <span className="font-bold block text-gray-400 uppercase tracking-wide">Gen Date</span>
                  <span className="text-gray-800 font-medium truncate block">
                    {threeDGeneratedAt ? new Date(threeDGeneratedAt).toLocaleDateString() : '—'}
                  </span>
                </div>
                <div>
                  <span className="font-bold block text-gray-400 uppercase tracking-wide">Model Size</span>
                  <input
                    type="number"
                    placeholder="Bytes"
                    value={threeDFileSize}
                    onChange={(e) => setThreeDFileSize(e.target.value)}
                    className="w-full bg-transparent border-none p-0 focus:ring-0 text-[10px] text-gray-800 font-medium font-mono"
                  />
                </div>
                <div>
                  <span className="font-bold block text-gray-400 uppercase tracking-wide">Image Hash</span>
                  <input
                    type="text"
                    placeholder="sha256"
                    value={threeDImageHash}
                    onChange={(e) => setThreeDImageHash(e.target.value)}
                    className="w-full bg-transparent border-none p-0 focus:ring-0 text-[10px] text-gray-800 font-medium font-mono"
                  />
                </div>

                <div>
                  <span className="font-bold block text-gray-400 uppercase tracking-wide">GPU Used</span>
                  <input
                    type="text"
                    placeholder="e.g. RTX 5060 Ti"
                    value={threeDGpuUsed}
                    onChange={(e) => setThreeDGpuUsed(e.target.value)}
                    className="w-full bg-transparent border-none p-0 focus:ring-0 text-[10px] text-gray-800 font-medium"
                  />
                </div>
                <div>
                  <span className="font-bold block text-gray-400 uppercase tracking-wide">VRAM Consumed</span>
                  <input
                    type="text"
                    placeholder="e.g. 4.2 GB"
                    value={threeDVramUsage}
                    onChange={(e) => setThreeDVramUsage(e.target.value)}
                    className="w-full bg-transparent border-none p-0 focus:ring-0 text-[10px] text-gray-800 font-medium font-mono"
                  />
                </div>
                <div>
                  <span className="font-bold block text-gray-400 uppercase tracking-wide">Texture Res</span>
                  <input
                    type="text"
                    placeholder="e.g. 1024x1024"
                    value={threeDTextureResolution}
                    onChange={(e) => setThreeDTextureResolution(e.target.value)}
                    className="w-full bg-transparent border-none p-0 focus:ring-0 text-[10px] text-gray-800 font-medium font-mono"
                  />
                </div>

                <div>
                  <span className="font-bold block text-gray-400 uppercase tracking-wide">Gen Time</span>
                  <input
                    type="text"
                    placeholder="e.g. 12.5s"
                    value={threeDGenerationTime}
                    onChange={(e) => setThreeDGenerationTime(e.target.value)}
                    className="w-full bg-transparent border-none p-0 focus:ring-0 text-[10px] text-gray-800 font-medium font-mono"
                  />
                </div>
                <div>
                  <span className="font-bold block text-gray-400 uppercase tracking-wide">Est. Remaining</span>
                  <input
                    type="text"
                    placeholder="e.g. 30s"
                    value={threeDEstimatedTime}
                    onChange={(e) => setThreeDEstimatedTime(e.target.value)}
                    className="w-full bg-transparent border-none p-0 focus:ring-0 text-[10px] text-gray-800 font-medium font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <span className="font-bold block text-gray-400 uppercase tracking-wide">Verts</span>
                    <input
                      type="text"
                      placeholder="0"
                      value={threeDVertices}
                      onChange={(e) => setThreeDVertices(e.target.value)}
                      className="w-full bg-transparent border-none p-0 focus:ring-0 text-[10px] text-gray-800 font-medium font-mono"
                    />
                  </div>
                  <div>
                    <span className="font-bold block text-gray-400 uppercase tracking-wide">Faces</span>
                    <input
                      type="text"
                      placeholder="0"
                      value={threeDFaces}
                      onChange={(e) => setThreeDFaces(e.target.value)}
                      className="w-full bg-transparent border-none p-0 focus:ring-0 text-[10px] text-gray-800 font-medium font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Error Display Card */}
              {threeDError && (
                <div className="bg-red-50 border border-red-150 rounded-lg p-2.5 text-[10px] text-red-700 font-medium space-y-1">
                  <span className="font-bold block text-red-500 uppercase tracking-wide">Pipeline Error Log</span>
                  <p className="font-mono text-xs whitespace-pre-wrap max-h-20 overflow-y-auto">{threeDError}</p>
                </div>
              )}

              {/* Thumbnail Display */}
              {threeDThumbnailUrl && (
                <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-150">
                  <div className="relative w-12 h-12 rounded overflow-hidden border shrink-0 bg-gray-50">
                    <img src={threeDThumbnailUrl} alt="3D Model Thumbnail" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">
                    <span className="font-semibold block text-gray-500 uppercase">Preview</span>
                    {threeDThumbnailUrl}
                  </div>
                </div>
              )}

              {/* Toolbar Buttons: Generate, Delete, Download */}
              <div className="flex gap-2 pt-1.5">
                <button
                  type="button"
                  disabled={generating || !product?._id || (threeDStatus !== 'none' && threeDStatus !== 'failed')}
                  onClick={() => handleGenerate(false)}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                    !product?._id || (threeDStatus !== 'none' && threeDStatus !== 'failed')
                      ? 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-650 border border-blue-700 text-white hover:bg-blue-700 cursor-pointer'
                  }`}
                >
                  Generate Model
                </button>

                <button
                  type="button"
                  disabled={generating || !product?._id || (threeDStatus !== 'ready' && threeDStatus !== 'failed')}
                  onClick={() => handleGenerate(true)}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    !product?._id || (threeDStatus !== 'ready' && threeDStatus !== 'failed')
                      ? 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  Regenerate
                </button>

                <button
                  type="button"
                  onClick={handleDeleteModel}
                  className="py-1.5 px-3 rounded-lg border border-red-200 text-red-650 hover:bg-red-50 text-xs font-bold transition-all cursor-pointer"
                >
                  Delete Model
                </button>

                {threeDModelUrl ? (
                  <a
                    href={threeDModelUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-3 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 text-xs font-bold text-center transition-all flex items-center justify-center cursor-pointer"
                  >
                    Download
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="py-1.5 px-3 rounded-lg bg-gray-100 border border-gray-200 text-gray-400 text-xs font-bold cursor-not-allowed select-none"
                  >
                    Download
                  </button>
                )}
              </div>

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
