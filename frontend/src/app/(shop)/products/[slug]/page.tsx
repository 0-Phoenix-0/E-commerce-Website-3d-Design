'use client';

<<<<<<< HEAD
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
=======
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
>>>>>>> d28d33f (AI service update)
import Image from 'next/image';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { useAuth } from '@/lib/auth';
import { formatCents } from '@/lib/utils';
import type { Product, ProductReview, ThreeDModel } from '@/types';
import ProductCard from '@/components/ProductCard';
import ThreeDViewer from '@/components/threeD/ThreeDViewer';
<<<<<<< HEAD
import ThreeDStatus from '@/components/threeD/ThreeDStatus';
import TryOnModal from '@/components/tryOn/TryOnModal';
import PriceHistoryChart from '@/components/PriceHistoryChart';
=======
>>>>>>> d28d33f (AI service update)

interface UploadSignData {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
}

// ── Stage label → progress color ─────────────────────────────────────────────
const STAGE_LABELS = [
  'Queued',
  'Preparing Images',
  'Removing Background',
  'Generating Shape',
  'Generating Texture',
  'Assembling Model',
  'Finalizing Preview',
  'Uploading to Cloudinary',
  'Completed',
];

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0)
    return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />Out of stock</span>;
  if (stock < 10)
    return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600"><span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />Low stock — {stock} left</span>;
  return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700"><span className="w-2 h-2 rounded-full bg-green-500" />In stock</span>;
}

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { addToCart } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [cartMessage, setCartMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [wishlisted, setWishlisted] = useState(false);
  const [togglingWishlist, setTogglingWishlist] = useState(false);

<<<<<<< HEAD
  // Virtual Try-On Modal
  const [showTryOn, setShowTryOn] = useState(false);
  
  // Gallery, Zoom, Tabs
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryZoom, setGalleryZoom] = useState(false);
  const galleryScrollRef = useRef<HTMLDivElement>(null);

  // Center the zoomed image within its scroll container
  function toggleGalleryZoom() {
    setGalleryZoom((z) => {
      const next = !z;
      if (next) {
        requestAnimationFrame(() => {
          const el = galleryScrollRef.current;
          if (!el) return;
          el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
          el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
        });
      }
      return next;
    });
  }
  const [activeTab, setActiveTab] = useState<'description' | 'specifications' | 'priceHistory' | 'reviews' | 'shipping'>('description');
=======
  // Gallery: activeImageIdx = 0..N-1 for product images, 'threed' for the 3D viewer
  const [activeView, setActiveView] = useState<number | '3d'>(0);

  // Tabs
  const [activeTab, setActiveTab] = useState<'description' | 'specifications' | 'reviews' | 'shipping' | '3d-options'>('description');
>>>>>>> d28d33f (AI service update)
  const [related, setRelated] = useState<Product[]>([]);
  const [copied, setCopied] = useState(false);

  // 3D generation state
  const [generating3D, setGenerating3D] = useState(false);
  const [threeDData, setThreeDData] = useState<ThreeDModel | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Review Filters
  const [reviewRatingFilter, setReviewRatingFilter] = useState<number>(0);
  const [reviewSort, setReviewSort] = useState<'recent' | 'highest' | 'lowest'>('recent');

  // Write Review Modal States
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [writeRating, setWriteRating] = useState(5);
  const [writeTitle, setWriteTitle] = useState('');
  const [writeComment, setWriteComment] = useState('');
  const [writeFiles, setWriteFiles] = useState<{ file: File; preview: string }[]>([]);
  const [submittingReview, setSubmittingReview] = useState(false);

  // ── 3D polling ────────────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback((productId: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.get<{ status: string; modelUrl: string | null; previewImage: string | null; metadata: ThreeDModel }>(`/products/${productId}/3d`);
        if (res.success && res.data) {
          const d = res.data as any;
          const newThreeD: ThreeDModel = {
            enabled: d.metadata?.enabled ?? false,
            status: d.status,
            modelUrl: d.modelUrl,
            previewImage: d.previewImage,
            thumbnailUrl: d.metadata?.thumbnailUrl ?? null,
            engine: d.metadata?.engine ?? null,
            version: d.metadata?.version ?? null,
            generatedAt: d.metadata?.generatedAt ?? null,
            imageHash: d.metadata?.imageHash ?? null,
            generationTime: d.metadata?.generationTime ?? null,
            fileSize: d.metadata?.fileSize ?? null,
            estimatedTime: d.metadata?.estimatedTime ?? null,
            error: d.metadata?.error ?? null,
            stageLabel: d.metadata?.stageLabel ?? null,
            generationSettings: d.metadata?.generationSettings ?? null,
            meshStats: d.metadata?.meshStats ?? null,
          };

          setThreeDData(newThreeD);
          setProduct((prev) => prev ? { ...prev, threeD: newThreeD } : prev);

          if (newThreeD.status === 'ready') {
            stopPolling();
            // Auto-switch to 3D view when generation completes
            setActiveView('3d');
          } else if (newThreeD.status === 'failed') {
            stopPolling();
          }
        }
      } catch (err) {
        console.error('Error polling 3D status:', err);
      }
    }, 3000);
  }, [stopPolling]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // ── Product Load ──────────────────────────────────────────────────────────
  useEffect(() => {
    api.get<Product>(`/products/slug/${slug}`).then((res) => {
      if (res.success && res.data) {
        setProduct(res.data);
        setThreeDData(res.data.threeD ?? null);
        setActiveView(0);
        // If already processing, start polling immediately
        if (res.data.threeD?.status === 'processing') {
          startPolling(res.data._id);
        }
        // If ?view=3d in URL, auto-select the 3D view
        if (searchParams?.get('view') === '3d' && res.data.threeD?.status === 'ready') {
          setActiveView('3d');
        }
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });
  }, [slug, searchParams, startPolling]);

  // ── Related Products ──────────────────────────────────────────────────────
  useEffect(() => {
    if (product) {
      const catId = typeof product.category === 'object' ? product.category._id : product.category;
      api.get<Product[]>(`/products?category=${catId}&limit=5`).then((res) => {
        if (res.success && res.data) {
          setRelated(res.data.filter((p) => p._id !== product._id).slice(0, 4));
        }
      });
    }
  }, [product?._id]);

  // ── Wishlist ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (product && user) {
      api.get<{ wishlisted: boolean }>(`/wishlist/check/${product._id}`).then((res) => {
        if (res.success && res.data) setWishlisted(res.data.wishlisted);
      });
    }
  }, [product?._id, user]);

  async function handleToggleWishlist() {
    if (!user || !product) {
      router.push(`/login?next=/products/${slug}`);
      return;
    }
    setTogglingWishlist(true);
    const res = await api.post<{ wishlisted: boolean }>(`/wishlist/${product._id}`, {});
    if (res.success && res.data) setWishlisted(res.data.wishlisted);
    setTogglingWishlist(false);
  }

  async function handleAddToCart() {
    if (!user) {
      router.push(`/login?next=/products/${slug}`);
      return;
    }
    if (!product) return;

    setAdding(true);
    setCartMessage(null);
    const error = await addToCart(product._id, quantity);
    if (error) {
      setCartMessage({ type: 'error', text: error });
    } else {
      setCartMessage({ type: 'success', text: 'Product added to your cart!' });
      setTimeout(() => setCartMessage(null), 4000);
    }
    setAdding(false);
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── 3D Generation ─────────────────────────────────────────────────────────
  async function handleStartGeneration() {
    if (!product || generating3D) return;
    setGenerating3D(true);
    try {
      const res = await api.post<any>(`/products/${product._id}/3d/generate`, {});
      if (res.success && res.data) {
        const newThreeD = res.data as ThreeDModel;
        setThreeDData(newThreeD);
        setProduct((prev) => prev ? { ...prev, threeD: newThreeD } : prev);
        if (newThreeD.status === 'processing') {
          startPolling(product._id);
        }
      }
    } catch (err) {
      console.error('Failed to start 3D generation:', err);
    }
    setGenerating3D(false);
  }

  // ── Review Submit ─────────────────────────────────────────────────────────
  async function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    setSubmittingReview(true);

    try {
      let reviewImages: { url: string; publicId: string }[] = [];
      if (writeFiles.length > 0) {
        const signRes = await api.post<UploadSignData>('/upload/sign', {});
        if (!signRes.success || !signRes.data) {
          throw new Error('Failed to get upload signature');
        }
        for (const f of writeFiles) {
          const form = new FormData();
          form.append('file', f.file);
          form.append('api_key', signRes.data.apiKey);
          form.append('timestamp', String(signRes.data.timestamp));
          form.append('signature', signRes.data.signature);
          form.append('folder', signRes.data.folder);

          const uploadRes = await fetch(
            `https://api.cloudinary.com/v1_1/${signRes.data.cloudName}/image/upload`,
            { method: 'POST', body: form }
          );
          if (!uploadRes.ok) {
            throw new Error('Image upload failed');
          }
          const uploadData = await uploadRes.json() as { secure_url: string; public_id: string };
          reviewImages.push({
            url: uploadData.secure_url,
            publicId: uploadData.public_id
          });
        }
      }

      const res = await api.post<ProductReview[]>(`/products/${product._id}/reviews`, {
        rating: writeRating,
        title: writeTitle,
        comment: writeComment,
        images: reviewImages
      });

      if (res.success && res.data) {
        const rawRes = res as any;
        setProduct((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            reviews: res.data,
            rating: typeof rawRes.rating === 'number' ? rawRes.rating : prev.rating,
            reviewCount: typeof rawRes.reviewCount === 'number' ? rawRes.reviewCount : prev.reviewCount
          };
        });
        setWriteRating(5);
        setWriteTitle('');
        setWriteComment('');
        setWriteFiles([]);
        setShowWriteModal(false);
      } else {
        alert(res.message || 'Failed to submit review');
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred during submission');
    } finally {
      setSubmittingReview(false);
    }
  }

<<<<<<< HEAD
  useEffect(() => {
    api.get<Product>(`/products/slug/${slug}`).then((res) => {
      if (res.success && res.data) {
        setProduct(res.data);
        setActiveImageIdx(0);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });
  }, [slug]);

  // Load Related Products
  useEffect(() => {
    if (product) {
      const catId = typeof product.category === 'object' ? product.category._id : product.category;
      api.get<Product[]>(`/products?category=${catId}&limit=5`).then((res) => {
        if (res.success && res.data) {
          setRelated(res.data.filter((p) => p._id !== product._id).slice(0, 4));
        }
      });
    }
  }, [product]);

  // Check wishlist status once product + user are loaded
  useEffect(() => {
    if (product && user) {
      api.get<{ wishlisted: boolean }>(`/wishlist/check/${product._id}`).then((res) => {
        if (res.success && res.data) setWishlisted(res.data.wishlisted);
      });
    }
  }, [product, user]);

  async function handleToggleWishlist() {
    if (!user || !product) {
      router.push(`/login?next=/products/${slug}`);
      return;
    }
    setTogglingWishlist(true);
    const res = await api.post<{ wishlisted: boolean }>(`/wishlist/${product._id}`, {});
    if (res.success && res.data) setWishlisted(res.data.wishlisted);
    setTogglingWishlist(false);
  }

  async function handleAddToCart() {
    if (!user) {
      router.push(`/login?next=/products/${slug}`);
      return;
    }
    if (!product) return;

    setAdding(true);
    setCartMessage(null);
    const error = await addToCart(product._id, quantity);
    if (error) {
      setCartMessage({ type: 'error', text: error });
    } else {
      setCartMessage({ type: 'success', text: 'Product added to your cart!' });
      setTimeout(() => setCartMessage(null), 4000);
    }
    setAdding(false);
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenTryOn() {
    if (!user) {
      router.push(`/login?next=/products/${slug}`);
      return;
    }
    setShowTryOn(true);
  }

  // Fullscreen gallery navigation
  function openGallery(idx: number) {
    setActiveImageIdx(idx);
    setGalleryZoom(false);
    setGalleryOpen(true);
  }

  function galleryStep(delta: number) {
    setGalleryZoom(false);
    setActiveImageIdx((prev) => {
      const count = product?.images.length ?? 0;
      if (count === 0) return prev;
      return (prev + delta + count) % count;
    });
  }

  // Keyboard nav + scroll lock for the fullscreen gallery
  useEffect(() => {
    if (!galleryOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setGalleryOpen(false);
      else if (e.key === 'ArrowRight') galleryStep(1);
      else if (e.key === 'ArrowLeft') galleryStep(-1);
    }
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryOpen, product?.images.length]);

  // Poll 3D model status if currently processing
  useEffect(() => {
    if (!product || product.threeD?.status !== 'processing') return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get<Product>(`/products/slug/${slug}`);
        if (res.success && res.data) {
          if (
            res.data.threeD?.status !== product.threeD?.status ||
            res.data.threeD?.estimatedTime !== product.threeD?.estimatedTime ||
            res.data.threeD?.modelUrl !== product.threeD?.modelUrl
          ) {
            setProduct(res.data);
          }
        }
      } catch (err) {
        console.error('Error polling 3D generation status:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [product, slug]);

  async function handleStartOnDemand3D() {
    if (!product) return;
    try {
      const res = await api.post<any>(`/products/${product._id}/3d/generate`, {});
      if (res.success && res.data) {
        setProduct({
          ...product,
          threeD: res.data
        });
      }
    } catch (err) {
      console.error('Failed to trigger on-demand generation:', err);
    }
  }

  const calcThreeDProgress = () => {
    if (!product?.threeD) return 0;
    if (product.threeD.status === 'ready') return 100;
    if (product.threeD.status !== 'processing') return 0;
    const est = product.threeD.estimatedTime ?? 30;
    const ratio = Math.max(0, Math.min(1, (30 - est) / 30));
    return Math.round(10 + ratio * 85);
  };

  // Loading skeleton
=======
  // ── Loading skeleton ───────────────────────────────────────────────────────
>>>>>>> d28d33f (AI service update)
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-4">
            <div className="aspect-square bg-gray-100 rounded-3xl" />
            <div className="flex gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="w-20 h-20 bg-gray-100 rounded-xl" />
              ))}
            </div>
          </div>
          <div className="space-y-4 pt-2">
            <div className="h-4 w-24 bg-gray-100 rounded" />
            <div className="h-8 w-3/4 bg-gray-100 rounded" />
            <div className="h-6 w-28 bg-gray-100 rounded mt-4" />
            <div className="h-20 w-full bg-gray-100 rounded mt-6" />
            <div className="h-12 w-full bg-gray-100 rounded mt-6" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <p className="text-2xl font-bold text-gray-900 mb-2">Product not found</p>
        <p className="text-gray-500 mb-8">The product you&apos;re looking for doesn&apos;t exist or has been removed.</p>
        <Link href="/products" className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors">
          ← Browse Products
        </Link>
      </div>
    );
  }

  const images = product.images.length > 0 ? product.images : [{ url: '', publicId: 'empty', type: 'image' as const }];
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const categoryName = typeof product.category === 'object' ? product.category.name : null;
  const categoryId = typeof product.category === 'object' ? product.category._id : product.category;

  const ratingNum = product.rating ?? 0;
  const ratingVal = ratingNum.toFixed(1);
  const reviewsCount = product.reviews?.length ?? 0;
  const brandName = product.brand || product.name.split(' ')[0] || 'Generic';

  // The active 3D data — use latest from polling if available
  const threeD = threeDData ?? product.threeD ?? null;
  const has3DReady = threeD?.status === 'ready' && !!threeD?.modelUrl;
  const has3DProcessing = threeD?.status === 'processing';
  const has3DFailed = threeD?.status === 'failed';
  const has3DAny = has3DReady || has3DProcessing || has3DFailed;

  // Current image shown in main area (when activeView is a number)
  const currentImageIdx = typeof activeView === 'number' ? activeView : 0;
  const currentImage = images[currentImageIdx];

  const specs = [
    { label: 'Brand', value: brandName },
    ...(product.minimumOrderQuantity ? [{ label: 'Minimum Order Quantity', value: String(product.minimumOrderQuantity) }] : []),
    ...(product.warrantyInformation ? [{ label: 'Warranty', value: product.warrantyInformation }] : []),
    ...(product.shippingInformation ? [{ label: 'Shipping', value: product.shippingInformation }] : []),
    ...(product.returnPolicy ? [{ label: 'Return Policy', value: product.returnPolicy }] : []),
    ...(product.tags && product.tags.length > 0 ? [{ label: 'Tags', value: product.tags.join(', ') }] : []),
  ];

  const rawReviews = (product.reviews || []).map((r) => ({
    id: r._id || String(Math.random()),
    author: r.reviewerName,
    rating: r.rating,
    title: r.title,
    date: r.date ? new Date(r.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A',
    comment: r.comment,
    verified: r.verifiedPurchase ?? false,
    images: r.images ?? [],
  }));

  const filteredReviews = rawReviews
    .filter((r) => reviewRatingFilter === 0 || r.rating === reviewRatingFilter)
    .sort((a, b) => {
      if (reviewSort === 'highest') return b.rating - a.rating;
      if (reviewSort === 'lowest') return a.rating - b.rating;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  const distribution = [0, 0, 0, 0, 0, 0];
  product.reviews?.forEach((r) => {
    const rNum = Math.round(r.rating);
    if (rNum >= 1 && rNum <= 5) distribution[rNum]++;
  });

  // 3D progress calculation
  const threeDProgress = (() => {
    if (!threeD || threeD.status === 'none') return 0;
    if (threeD.status === 'ready') return 100;
    if (threeD.status === 'failed') return 0;
    const est = threeD.estimatedTime ?? 30;
    const ratio = Math.max(0, Math.min(1, (30 - est) / 30));
    return Math.round(10 + ratio * 85);
  })();

  // Stage label from DB or derived from progress
  const currentStageLabel = threeD?.stageLabel || (has3DProcessing ? 'Processing...' : has3DReady ? 'Completed' : 'Not Started');

  // Tab definitions (conditionally include '3d-options')
  const tabs = [
    { id: 'description' as const, label: 'Description' },
    { id: 'specifications' as const, label: 'Specifications' },
    { id: 'reviews' as const, label: 'Reviews' },
    { id: 'shipping' as const, label: 'Shipping & Returns' },
    ...(!has3DReady ? [{ id: '3d-options' as const, label: '3D Options' }] : []),
  ];

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-8 uppercase tracking-wider">
          <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-gray-900 transition-colors">Products</Link>
          {categoryName && (
            <>
              <span>/</span>
              <Link href={`/products?category=${categoryId}`} className="hover:text-gray-900 transition-colors">{categoryName}</Link>
            </>
          )}
          <span>/</span>
          <span className="text-gray-600 truncate max-w-xs">{product.name}</span>
        </nav>

        {/* Product details core grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">

          {/* Left Column: Interactive Media Gallery */}
          <div className="space-y-4">
<<<<<<< HEAD
            {/* Main Media container with Zoom hover */}
            <div className="product-media-surface relative aspect-square rounded-3xl overflow-hidden bg-gray-50 border border-gray-150 group">
              {currentImage.url ? (
=======

            {/* Main Media Area */}
            <div className="relative aspect-square rounded-3xl overflow-hidden bg-gray-50 border border-gray-150 group">
              {activeView === '3d' ? (
                /* 3D Viewer fills the main media area */
                <div className="absolute inset-0">
                  <ThreeDViewer
                    modelUrl={threeD?.modelUrl ?? null}
                    previewImage={threeD?.previewImage ?? null}
                  />
                </div>
              ) : currentImage.url ? (
>>>>>>> d28d33f (AI service update)
                currentImage.type === 'video' ? (
                  <video
                    src={currentImage.url}
                    controls
                    autoPlay
                    loop
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="relative w-full h-full overflow-hidden cursor-zoom-in"
                    onClick={() => openGallery(activeImageIdx)}
                  >
                    <Image
                      src={currentImage.url}
                      alt={product.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover transition-transform duration-500 hover:scale-110"
                      priority
                    />
                    {/* Zoom / expand hint */}
                    <span className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-black/55 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.35-5.4a6.75 6.75 0 11-13.5 0 6.75 6.75 0 0113.5 0zM10.5 7.5v6m3-3h-6" />
                      </svg>
                      Click to zoom
                    </span>
                  </div>
                )
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-200">
                  <svg className="w-24 h-24" fill="none" stroke="currentColor" strokeWidth={0.75} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M21 21H3a.75.75 0 01-.75-.75V5.25A.75.75 0 013 4.5h18a.75.75 0 01.75.75v15A.75.75 0 0121 21z" />
                  </svg>
                </div>
              )}

              {/* Discount badge overlay */}
              {hasDiscount && activeView !== '3d' && (
                <span className="absolute top-4 left-4 bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm z-10">
                  SALE
                </span>
              )}

<<<<<<< HEAD
            {/* Thumbnail list */}
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {images.map((img, idx) => {
                  const isVideo = img.type === 'video';
                  return (
                    <button
                      key={img.publicId}
                      onClick={() => setActiveImageIdx(idx)}
                      className={`product-media-surface relative w-20 h-20 rounded-xl overflow-hidden border shrink-0 bg-gray-50 transition-all ${
                        activeImageIdx === idx
                          ? 'border-gray-950 ring-2 ring-gray-950/10'
                          : 'border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {isVideo ? (
                        <>
                          <video src={img.url} className="w-full h-full object-cover pointer-events-none" muted />
                          <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                            <svg className="w-6 h-6 text-white fill-current" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </>
                      ) : (
                        <Image src={img.url} alt="" fill className="object-cover" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 3D Viewer Section */}
            <div className="mt-8 pt-6 border-t border-gray-150">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
=======
              {/* 3D view badge */}
              {activeView === '3d' && (
                <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-indigo-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
>>>>>>> d28d33f (AI service update)
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                  </svg>
                  Interactive 3D
                </div>
              )}
            </div>

            {/* Thumbnail Strip — images + optional 3D thumbnail */}
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {/* Product image thumbnails */}
              {images.map((img, idx) => {
                if (images.length <= 1 && !has3DReady) return null;
                const isVideo = img.type === 'video';
                const isActive = activeView === idx;
                return (
                  <button
                    key={img.publicId}
                    id={`thumb-img-${idx}`}
                    onClick={() => setActiveView(idx)}
                    className={`relative w-20 h-20 rounded-xl overflow-hidden border shrink-0 bg-gray-50 transition-all ${
                      isActive
                        ? 'border-gray-950 ring-2 ring-gray-950/10'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {isVideo ? (
                      <>
                        <video src={img.url} className="w-full h-full object-cover pointer-events-none" muted />
                        <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                          <svg className="w-6 h-6 text-white fill-current" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </>
                    ) : img.url ? (
                      <Image src={img.url} alt="" fill className="object-cover" />
                    ) : null}
                  </button>
                );
              })}

              {/* 3D Thumbnail — only shown when model is ready */}
              {has3DReady && (
                <button
                  id="thumb-3d"
                  onClick={() => setActiveView('3d')}
                  title="View in 3D"
                  className={`relative w-20 h-20 rounded-xl overflow-hidden border shrink-0 transition-all ${
                    activeView === '3d'
                      ? 'border-indigo-600 ring-2 ring-indigo-500/20'
                      : 'border-gray-200 hover:border-indigo-400'
                  }`}
                >
                  {/* Preview image or cube icon as background */}
                  {threeD?.previewImage ? (
                    <Image src={threeD.previewImage} alt="3D model preview" fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full bg-indigo-50 flex items-center justify-center">
                      <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                      </svg>
                    </div>
                  )}
                  {/* "3D" label overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-end pb-1.5 bg-gradient-to-t from-indigo-900/70 via-transparent to-transparent">
                    <span className="text-[9px] font-black text-white uppercase tracking-widest leading-none">3D</span>
                  </div>
                </button>
              )}
            </div>

          </div>

          {/* Right Column: Information details */}
          <div className="flex flex-col">
            {categoryName && (
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-2 block">
                {categoryName}
              </span>
            )}

            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-tight mb-3">
              {product.name}
            </h1>

            {/* Rating */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex text-yellow-450">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className={`w-4 h-4 ${i < Math.round(ratingNum) ? 'fill-current' : 'text-gray-200'}`}
                    viewBox="0 0 20 20"
                    fill={i < Math.round(ratingNum) ? 'currentColor' : 'none'}
                    stroke="currentColor"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-xs font-semibold text-gray-500">
                {ratingVal} ({reviewsCount} verified reviews)
              </span>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-3xl font-extrabold text-gray-900">{formatCents(product.price)}</span>
              {hasDiscount && (
                <>
                  <span className="text-lg text-gray-400 line-through font-semibold">{formatCents(product.compareAtPrice!)}</span>
                  <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded">
                    Save {product.discountPercentage ?? Math.round((1 - product.price / product.compareAtPrice!) * 100)}%
                  </span>
                </>
              )}
            </div>

            {/* Stock */}
            <div className="mb-4">
              <StockBadge stock={product.stock} />
            </div>

<<<<<<< HEAD
            {/* Price history / forecast quick link */}
            <button
              onClick={() => {
                setActiveTab('priceHistory');
                document.getElementById('product-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="mb-6 inline-flex items-center gap-2 self-start text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 14l4-4 3 3 5-6" />
              </svg>
              View price history &amp; forecast
            </button>

            {/* Key product info list (Brand, Warranty, Shipping, return, min quantity, availability status) */}
=======
            {/* Key Info Grid */}
>>>>>>> d28d33f (AI service update)
            <div className="grid grid-cols-2 gap-4 border-t border-b border-gray-100 py-4 mb-6 text-xs sm:text-sm text-gray-600">
              {brandName && (
                <div>
                  <span className="font-semibold text-gray-400">Brand:</span>{' '}
                  <span className="font-bold text-gray-900">{brandName}</span>
                </div>
              )}
              {product.availabilityStatus && (
                <div>
                  <span className="font-semibold text-gray-400">Availability:</span>{' '}
                  <span className="font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded text-[11px]">{product.availabilityStatus}</span>
                </div>
              )}
              {product.warrantyInformation && (
                <div>
                  <span className="font-semibold text-gray-400">Warranty:</span>{' '}
                  <span className="text-gray-700">{product.warrantyInformation}</span>
                </div>
              )}
              {product.shippingInformation && (
                <div>
                  <span className="font-semibold text-gray-400">Shipping:</span>{' '}
                  <span className="text-gray-700">{product.shippingInformation}</span>
                </div>
              )}
              {product.returnPolicy && (
                <div>
                  <span className="font-semibold text-gray-400">Returns:</span>{' '}
                  <span className="text-gray-700">{product.returnPolicy}</span>
                </div>
              )}
              {product.minimumOrderQuantity !== undefined && (
                <div>
                  <span className="font-semibold text-gray-400">Min. Order:</span>{' '}
                  <span className="text-gray-700">{product.minimumOrderQuantity} units</span>
                </div>
              )}
            </div>

            {/* 3D Quick Access Banner — only when ready */}
            {has3DReady && activeView !== '3d' && (
              <button
                id="view-3d-banner-btn"
                onClick={() => setActiveView('3d')}
                className="mb-5 flex items-center gap-3 w-full px-4 py-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-2xl transition-all text-left group"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-indigo-900">View in 3D</p>
                  <p className="text-xs text-indigo-600">Interactive 3D model — rotate, zoom, inspect</p>
                </div>
                <svg className="w-4 h-4 text-indigo-400 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            )}

            {/* Cart Message */}
            {cartMessage && (
              <div className={`mb-5 rounded-2xl px-4 py-3.5 text-sm font-semibold border ${
                cartMessage.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {cartMessage.text}
              </div>
            )}

            {/* Quantity + Add to Cart */}
            {product.stock > 0 ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center border border-gray-200 rounded-2xl overflow-hidden shrink-0 bg-white">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-12 h-12 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
                    </svg>
                  </button>
                  <span className="w-10 text-center text-sm font-bold text-gray-900">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    className="w-12 h-12 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
                    aria-label="Increase quantity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                    </svg>
                  </button>
                </div>

                <button
                  id="add-to-cart-btn"
                  onClick={handleAddToCart}
                  disabled={adding}
                  className="flex-1 py-3 px-8 bg-gray-950 hover:bg-gray-900 text-white text-sm font-bold rounded-2xl transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed text-center"
                >
                  {adding ? 'Adding to Cart…' : user ? 'Add to Cart' : 'Sign in to Add to Cart'}
                </button>

                <button
                  id="wishlist-btn"
                  onClick={handleToggleWishlist}
                  disabled={togglingWishlist}
                  aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                  className={`flex items-center justify-center w-12 h-12 rounded-2xl border transition-colors disabled:opacity-50 ${
                    wishlisted
                      ? 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <svg className="w-5.5 h-5.5" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button disabled className="flex-1 py-3.5 px-8 bg-gray-100 text-gray-400 text-sm font-bold rounded-2xl cursor-not-allowed">
                  Out of Stock
                </button>
              </div>
            )}

<<<<<<< HEAD
            {/* Virtual Try-On button */}
            <button
              onClick={handleOpenTryOn}
              className="mt-3 w-full py-3 px-8 bg-white border-2 border-gray-950 text-gray-950 hover:bg-gray-950 hover:text-white text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
              {user ? 'Try It On Yourself' : 'Sign in to Try It On'}
            </button>

            {/* Share link and Shipping status */}
=======
            {/* Share */}
>>>>>>> d28d33f (AI service update)
            <div className="mt-6 flex flex-wrap items-center justify-between border-t border-gray-100 pt-5 gap-4">
              <span className="text-xs text-gray-400 flex items-center gap-1.5 font-semibold">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                Free shipping on orders over ₹7,164
              </span>

              <button
                onClick={handleShare}
                className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors uppercase tracking-wider"
              >
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186l5.566-2.783m-5.566 3.883l5.566 2.782m0-8.851a2.25 2.25 0 110 2.186m0-2.186l-5.566 2.783m5.566-3.883l-5.566-2.782m0 11.037a2.25 2.25 0 110-2.186M15.75 8.25a2.25 2.25 0 110-4.5 2.25 2.25 0 010 4.5z" />
                </svg>
                {copied ? 'Link Copied!' : 'Share'}
              </button>
            </div>

          </div>
        </div>

<<<<<<< HEAD
        {/* Tabbed Specs, Description, and Reviews */}
        <div id="product-tabs" className="mt-16 border-t border-gray-150 pt-10">
          <div className="flex border-b border-gray-100 mb-8 overflow-x-auto">
            <div className="flex space-x-8">
              {(
                [
                  { id: 'description', label: 'Description' },
                  { id: 'specifications', label: 'Specifications' },
                  { id: 'priceHistory', label: 'Price History' },
                  { id: 'reviews', label: 'Reviews' },
                  { id: 'shipping', label: 'Shipping & Returns' },
                ] as const
              ).map((tab) => (
=======
        {/* ── Tabbed Section ─────────────────────────────────────────────────── */}
        <div className="mt-16 border-t border-gray-150 pt-10">
          <div className="flex border-b border-gray-100 mb-8 overflow-x-auto">
            <div className="flex space-x-8">
              {tabs.map((tab) => (
>>>>>>> d28d33f (AI service update)
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-4 text-sm font-semibold tracking-wide border-b-2 whitespace-nowrap transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'border-gray-950 text-gray-950'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                  {tab.id === '3d-options' && has3DProcessing && (
                    <span className="ml-2 inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-48 text-sm text-gray-600 leading-relaxed max-w-4xl">

            {/* Description Tab */}
            {activeTab === 'description' && (
              <div className="space-y-4">
                <p className="font-semibold text-gray-900 text-base">Product Description</p>
                <p className="text-gray-500">{product.description}</p>
              </div>
            )}

            {/* Specifications Tab */}
            {activeTab === 'specifications' && (
              <div className="border border-gray-150 rounded-2xl overflow-hidden bg-white shadow-sm/5">
                <table className="min-w-full divide-y divide-gray-150">
                  <tbody className="divide-y divide-gray-100">
                    {specs.map((spec) => (
                      <tr key={spec.label} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-900 w-1/3 bg-gray-50/40">{spec.label}</td>
                        <td className="px-6 py-4 text-gray-500">{spec.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

<<<<<<< HEAD
            {activeTab === 'priceHistory' && (
              <PriceHistoryChart product={product} />
            )}

=======
            {/* Reviews Tab */}
>>>>>>> d28d33f (AI service update)
            {activeTab === 'reviews' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50/50 rounded-2xl p-6 border border-gray-150">
                  <div className="flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-200/80 pb-6 md:pb-0 md:pr-6">
                    <span className="text-5xl font-black text-gray-950 tracking-tight mb-2">{ratingVal}</span>
                    <div className="flex text-yellow-450 mb-2">
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} className={`w-4 h-4 ${i < Math.round(ratingNum) ? 'fill-current' : 'text-gray-200'}`} viewBox="0 0 20 20" fill={i < Math.round(ratingNum) ? 'currentColor' : 'none'} stroke="currentColor">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{reviewsCount} Customer Reviews</span>
                  </div>
                  <div className="col-span-2 flex flex-col justify-center space-y-2">
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const count = distribution[stars];
                      const pct = reviewsCount > 0 ? (count / reviewsCount) * 100 : 0;
                      return (
                        <div key={stars} className="flex items-center gap-3 text-xs font-bold text-gray-500">
                          <span className="w-12 text-right shrink-0">{stars} Stars</span>
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="bg-yellow-450 h-full rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-8 shrink-0 text-gray-400">{Math.round(pct)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-gray-100 pb-5">
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider shrink-0">Filter Stars</span>
                    <select value={reviewRatingFilter} onChange={(e) => setReviewRatingFilter(Number(e.target.value))} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold focus:border-gray-950 focus:outline-none transition-colors">
                      <option value="0">All Reviews</option>
                      <option value="5">5 Stars only</option>
                      <option value="4">4 Stars only</option>
                      <option value="3">3 Stars only</option>
                      <option value="2">2 Stars only</option>
                      <option value="1">1 Star only</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <select value={reviewSort} onChange={(e) => setReviewSort(e.target.value as any)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold focus:border-gray-950 focus:outline-none transition-colors mr-2">
                      <option value="recent">Most Recent</option>
                      <option value="highest">Highest Rated</option>
                      <option value="lowest">Lowest Rated</option>
                    </select>
                    {user ? (
                      <button onClick={() => setShowWriteModal(true)} className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm uppercase tracking-wider shrink-0">Write a Review</button>
                    ) : (
                      <Link href={`/login?next=/products/${product.slug}`} className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-xs font-bold transition-all inline-block uppercase tracking-wider shrink-0">Log in to Review</Link>
                    )}
                  </div>
                </div>

                {filteredReviews.length === 0 ? (
                  <p className="text-gray-450 italic py-6">No matching reviews found for this selection.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {filteredReviews.map((rev) => (
                      <div key={rev.id} className="border border-gray-150 bg-white rounded-2xl p-6 shadow-sm/5 space-y-3.5">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-gray-950">{rev.author}</span>
                            {rev.verified && (
                              <span className="inline-flex items-center gap-1 text-[8px] font-black text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200 uppercase tracking-wider">Verified Purchase</span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 font-semibold">{rev.date}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex text-yellow-450">
                            {[...Array(5)].map((_, i) => (
                              <svg key={i} className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-current' : 'text-gray-200'}`} viewBox="0 0 20 20" fill={i < rev.rating ? 'currentColor' : 'none'} stroke="currentColor">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                          {rev.title && <span className="font-bold text-gray-900 text-sm">{rev.title}</span>}
                        </div>
                        <p className="text-gray-650 text-sm">{rev.comment}</p>
                        {rev.images && rev.images.length > 0 && (
                          <div className="flex gap-2.5 pt-2">
                            {rev.images.map((img: any, i: number) => (
                              <a key={i} href={img.url} target="_blank" rel="noreferrer" className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 transition-transform hover:scale-105">
                                <Image src={img.url} alt="" fill className="object-cover" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Write Review Modal */}
                {showWriteModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={() => setShowWriteModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 text-left">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">Write a Product Review</h3>
                      <form onSubmit={handleReviewSubmit} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Rating</label>
                          <div className="flex gap-1.5">
                            {[1, 2, 3, 4, 5].map((stars) => (
                              <button type="button" key={stars} onClick={() => setWriteRating(stars)} className={`p-0.5 transition-colors ${stars <= writeRating ? 'text-yellow-450' : 'text-gray-200'}`}>
                                <svg className="w-8 h-8 fill-current" viewBox="0 0 20 20" stroke="currentColor">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Review Title</label>
                          <input type="text" required placeholder="e.g. Amazing quality, highly recommended!" value={writeTitle} onChange={(e) => setWriteTitle(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:border-gray-950 focus:outline-none transition-colors" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Comments</label>
                          <textarea rows={4} required placeholder="Share your experience with this product..." value={writeComment} onChange={(e) => setWriteComment(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:border-gray-950 focus:outline-none transition-colors resize-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Upload Review Images <span className="text-gray-300 font-normal">(optional)</span></label>
                          {writeFiles.length > 0 && (
                            <div className="grid grid-cols-4 gap-2 mb-2">
                              {writeFiles.map((wf, idx) => (
                                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-250 bg-gray-50">
                                  <Image src={wf.preview} alt="" fill className="object-cover" />
                                  <button type="button" onClick={() => setWriteFiles(writeFiles.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-0.5 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <label className="block w-full py-2 text-center rounded-lg border border-dashed border-gray-300 text-xs font-bold text-gray-550 hover:border-gray-400 hover:text-gray-700 transition-colors cursor-pointer select-none">
                            <span>➕ Add Review Images</span>
                            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files || []); const newItems = files.map((file) => ({ file, preview: URL.createObjectURL(file) })); setWriteFiles((prev) => [...prev, ...newItems]); }} />
                          </label>
                        </div>
                        <div className="flex gap-3 justify-end pt-2">
                          <button type="button" disabled={submittingReview} onClick={() => setShowWriteModal(false)} className="px-4 py-2 border border-gray-300 text-gray-750 font-semibold rounded-lg text-xs uppercase tracking-wider hover:bg-gray-50 transition-colors disabled:opacity-40">Cancel</button>
                          <button type="submit" disabled={submittingReview} className="px-4 py-2 bg-gray-900 text-white font-bold rounded-lg text-xs uppercase tracking-wider hover:bg-gray-800 transition-colors disabled:opacity-40 flex items-center gap-1.5">
                            {submittingReview && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            Submit Review
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Shipping Tab */}
            {activeTab === 'shipping' && (
              <div className="space-y-4">
                <p className="font-semibold text-gray-900 text-base">Shipping & Returns Information</p>
                <div className="text-gray-500 space-y-2">
<<<<<<< HEAD
                  {product.shippingInformation && (
                    <p>• <strong>Shipping Info:</strong> {product.shippingInformation}</p>
                  )}
                  {product.returnPolicy && (
                    <p>• <strong>Return Policy:</strong> {product.returnPolicy}</p>
                  )}
                  <p>• <strong>Free standard delivery</strong> is automatically applied to all orders value exceeding ₹7,164.</p>
=======
                  {product.shippingInformation && <p>• <strong>Shipping Info:</strong> {product.shippingInformation}</p>}
                  {product.returnPolicy && <p>• <strong>Return Policy:</strong> {product.returnPolicy}</p>}
                  <p>• <strong>Free standard delivery</strong> is automatically applied to all orders value exceeding $75.</p>
>>>>>>> d28d33f (AI service update)
                  <p>• Standard shipping takes approximately 3-5 business days depending on delivery address.</p>
                  <p>• We offer a comprehensive <strong>30-day return policy</strong>. Items must be returned in their original packaging and condition to qualify for standard refunds.</p>
                </div>
              </div>
            )}

            {/* 3D Options Tab — shown only when no ready model */}
            {activeTab === '3d-options' && (
              <div className="max-w-2xl">
                {/* Header Illustration */}
                <div className="flex flex-col items-center text-center py-8 mb-8 bg-gradient-to-b from-indigo-50 to-white rounded-3xl border border-indigo-100">
                  <div className="relative mb-6">
                    <div className="w-24 h-24 rounded-3xl bg-indigo-100 flex items-center justify-center">
                      <svg className="w-14 h-14 text-indigo-500" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                      </svg>
                    </div>
                    {has3DProcessing && (
                      <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center">
                        <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      </div>
                    )}
                    {has3DFailed && (
                      <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </div>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-2">AI-Generated 3D Model</h3>
                  <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
                    Generate a photorealistic interactive 3D model of this product using AI. Rotate, zoom, and inspect every detail before you buy.
                  </p>
                </div>

                {/* Status + Controls */}
                <div className="space-y-5">
                  {/* Info row */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Estimated Time</p>
                      <p className="font-bold text-gray-900">20–35 minutes</p>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Quality Preset</p>
                      <p className="font-bold text-gray-900 capitalize">{threeD?.generationSettings?.quality ?? 'Standard'}</p>
                    </div>
                  </div>

                  {/* Progress display when processing */}
                  {has3DProcessing && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                          <span className="text-sm font-bold text-indigo-900">Generating 3D Model</span>
                        </div>
                        <span className="text-sm font-bold text-indigo-700">{threeDProgress}%</span>
                      </div>

                      {/* Progress bar */}
                      <div className="h-2.5 bg-indigo-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                          style={{ width: `${threeDProgress}%` }}
                        />
                      </div>

                      {/* Stage label */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-indigo-700">{currentStageLabel}</span>
                      </div>

                      {/* Stage steps */}
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        {STAGE_LABELS.filter(l => l !== 'Queued').map((label) => {
                          const stageIdx = STAGE_LABELS.indexOf(label);
                          const currentIdx = STAGE_LABELS.indexOf(currentStageLabel);
                          const isDone = currentIdx > stageIdx;
                          const isCurrent = currentStageLabel === label;
                          return (
                            <div key={label} className={`flex items-center gap-1.5 text-[10px] font-semibold transition-colors ${
                              isDone ? 'text-indigo-600' : isCurrent ? 'text-indigo-800' : 'text-gray-400'
                            }`}>
                              {isDone ? (
                                <svg className="w-3 h-3 text-indigo-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                              ) : isCurrent ? (
                                <span className="w-3 h-3 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin shrink-0" />
                              ) : (
                                <span className="w-3 h-3 rounded-full border border-gray-300 shrink-0" />
                              )}
                              {label}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Failed state */}
                  {has3DFailed && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-red-800 mb-1">Generation Failed</p>
                          <p className="text-xs text-red-600">
                            {threeD?.error?.split('\n')[0] || 'The AI generation process encountered an error. This can happen due to low image contrast or resource constraints.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Generate / Retry button */}
                  {!has3DProcessing && (
                    <button
                      id="generate-3d-btn"
                      onClick={handleStartGeneration}
                      disabled={generating3D}
                      className={`w-full py-3.5 px-6 rounded-2xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${
                        has3DFailed
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      {generating3D ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Queuing...
                        </>
                      ) : has3DFailed ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                          Retry Generation
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                          Generate 3D Model with AI
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Related Products */}
        {related.length > 0 && (
          <div className="mt-24 border-t border-gray-150 pt-16">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-8 tracking-tight">You May Also Like</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {related.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          </div>
        )}

        {/* Virtual Try-On Modal */}
        {showTryOn && <TryOnModal product={product} onClose={() => setShowTryOn(false)} />}

      </div>

      {/* Fullscreen product gallery: zoom + prev/next */}
      {galleryOpen && currentImage.url && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90">
          {/* Backdrop click closes */}
          <div className="absolute inset-0" onClick={() => setGalleryOpen(false)} />

          {/* Close */}
          <button
            onClick={() => setGalleryOpen(false)}
            aria-label="Close"
            className="absolute top-4 right-4 z-10 p-2 text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Prev */}
          {images.length > 1 && (
            <button
              onClick={() => galleryStep(-1)}
              aria-label="Previous"
              className="absolute left-3 sm:left-6 z-10 p-2 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}

          {/* Media */}
          <div ref={galleryScrollRef} className="gallery-no-scrollbar relative z-[1] max-w-[92vw] max-h-[84vh] overflow-auto">
            {currentImage.type === 'video' ? (
              <video
                key={currentImage.url}
                src={currentImage.url}
                controls
                autoPlay
                loop
                className="gallery-fade max-w-[92vw] max-h-[84vh] object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={currentImage.url}
                src={currentImage.url}
                alt={product.name}
                onClick={toggleGalleryZoom}
                className={`select-none transition-all duration-300 ease-out ${
                  galleryZoom
                    ? 'max-w-none max-h-none w-[150%] sm:w-[120%] h-auto cursor-zoom-out'
                    : 'gallery-fade max-w-[92vw] max-h-[84vh] object-contain cursor-zoom-in'
                }`}
              />
            )}
          </div>

          {/* Next */}
          {images.length > 1 && (
            <button
              onClick={() => galleryStep(1)}
              aria-label="Next"
              className="absolute right-3 sm:right-6 z-10 p-2 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}

          {/* Thumbnail strip + counter */}
          <div className="absolute bottom-4 left-0 right-0 z-10 flex flex-col items-center gap-3 px-4">
            {images.length > 1 && (
              <div className="gallery-no-scrollbar flex gap-2 overflow-x-auto max-w-full pb-1">
                {images.map((img, idx) => (
                  <button
                    key={img.publicId}
                    onClick={() => {
                      setGalleryZoom(false);
                      setActiveImageIdx(idx);
                    }}
                    className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-colors ${
                      activeImageIdx === idx ? 'border-white' : 'border-white/25 hover:border-white/60'
                    }`}
                  >
                    {img.type === 'video' ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <video src={img.url} className="w-full h-full object-cover" muted />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </span>
                      </>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}
            <span className="text-white/70 text-xs font-semibold">
              {activeImageIdx + 1} / {images.length}
              {currentImage.type !== 'video' && (
                <span className="text-white/40 font-normal"> · click image to {galleryZoom ? 'zoom out' : 'zoom in'}</span>
              )}
            </span>
          </div>
        </div>
      )}

    </div>
  );
}
