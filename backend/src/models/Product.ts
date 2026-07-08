import mongoose, { Document, Schema } from 'mongoose';

export interface IProductImage {
  url: string;
  publicId: string;
  type?: 'image' | 'video';
}

export interface IProductReview {
  user?: mongoose.Types.ObjectId;
  reviewerName: string;
  rating: number;
  title?: string;
  comment: string;
  date: Date;
  verifiedPurchase?: boolean;
  images?: { url: string; publicId: string }[];
}

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  category: mongoose.Types.ObjectId;
  images: IProductImage[];
  stock: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // DummyJSON attributes
  brand?: string;
  rating?: number;
  discountPercentage?: number;
  tags?: string[];
  availabilityStatus?: string;
  shippingInformation?: string;
  returnPolicy?: string;
  warrantyInformation?: string;
  minimumOrderQuantity?: number;
  reviews?: IProductReview[];
  reviewCount?: number;

  // Badges
  featured?: boolean;
  bestSeller?: boolean;
  trending?: boolean;
  newArrival?: boolean;
  onSale?: boolean;
}

const reviewSchema = new Schema<IProductReview>({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewerName: { type: String, required: true, trim: true },
  rating: { type: Number, required: true, min: 0, max: 5 },
  title: { type: String, trim: true },
  comment: { type: String, required: true, trim: true },
  date: { type: Date, required: true, default: Date.now },
  verifiedPurchase: { type: Boolean, default: false },
  images: [
    {
      url: { type: String, required: true },
      publicId: { type: String, required: true },
    }
  ]
}, { _id: true }); // Enable _id for reviews subdocuments to support DELETE review by id

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
        type: { type: String, enum: ['image', 'video'], default: 'image' },
      },
    ],
    stock: { type: Number, required: true, min: 0, default: 0 },
    isDeleted: { type: Boolean, default: false },

    // Fields
    brand: { type: String, trim: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    discountPercentage: { type: Number, min: 0, max: 100 },
    tags: [{ type: String, trim: true }],
    availabilityStatus: { type: String, trim: true },
    shippingInformation: { type: String, trim: true },
    returnPolicy: { type: String, trim: true },
    warrantyInformation: { type: String, trim: true },
    minimumOrderQuantity: { type: Number, default: 1 },
    reviews: [reviewSchema],
    reviewCount: { type: Number, default: 0 },

    // Badge flags (optional, defaults to false)
    featured: { type: Boolean, default: false },
    bestSeller: { type: Boolean, default: false },
    trending: { type: Boolean, default: false },
    newArrival: { type: Boolean, default: false },
    onSale: { type: Boolean, default: false },
  },
  { timestamps: true }
);

productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ brand: 1 });
productSchema.index({ rating: 1 });

export const Product = mongoose.model<IProduct>('Product', productSchema);

