export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin';
  createdAt: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  isDeleted: boolean;
  createdAt: string;
}

export interface ProductImage {
  url: string;
  publicId: string;
  type?: 'image' | 'video';
}

export interface ProductReview {
  _id?: string;
  user?: string;
  reviewerName: string;
  rating: number;
  title?: string;
  comment: string;
  date: string;
  verifiedPurchase?: boolean;
  images?: { url: string; publicId: string }[];
}

export interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  price: number; // stored in cents
  compareAtPrice?: number; // stored in cents
  priceHistory?: { price: number; date: string }[];
  category: Category | string;
  images: ProductImage[];
  stock: number;
  isDeleted: boolean;
  createdAt: string;
  
  // New DummyJSON attributes
  brand?: string;
  rating?: number;
  discountPercentage?: number;
  tags?: string[];
  availabilityStatus?: string;
  shippingInformation?: string;
  returnPolicy?: string;
  warrantyInformation?: string;
  minimumOrderQuantity?: number;
  reviews?: ProductReview[];
  reviewCount?: number;

  // Badges
  featured?: boolean;
  bestSeller?: boolean;
  trending?: boolean;
  newArrival?: boolean;
  onSale?: boolean;
  threeD?: ThreeDModel;
}

export interface ThreeDModel {
  enabled: boolean;
  status: 'none' | 'processing' | 'ready' | 'failed';
  engine: string | null;
  version: string | null;
  modelUrl: string | null;
  thumbnailUrl: string | null;
  previewImage: string | null;
  generatedAt: string | null;
  imageHash: string | null;
  generationTime: number | null;
  fileSize: number | null;
  gpuUsed?: string | null;
  vramUsage?: number | null;
  textureResolution?: string | null;
  estimatedTime?: number | null;
  error?: string | null;
  meshStats?: {
    vertices: number;
    faces: number;
  } | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Cart {
  _id: string;
  user: string;
  items: CartItem[];
  updatedAt: string;
}

export interface OrderItem {
  product: string;
  name: string;
  imageUrl: string;
  price: number; // in cents, snapshot at time of order
  quantity: number;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface Order {
  _id: string;
  user: string | User;
  items: OrderItem[];
  totalAmount: number; // in cents
  status: OrderStatus;
  shippingAddress: ShippingAddress;
  createdAt: string;
}

export interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
}
