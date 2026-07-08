import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { Order } from '../models/Order';
import { AppError } from '../middleware/AppError';
import { v2 as cloudinary } from 'cloudinary';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function deleteFromCloudinary(publicId: string, type: 'image' | 'video'): Promise<void> {
  try {
    if (publicId.startsWith('dummyjson_')) return;
    await cloudinary.uploader.destroy(publicId, { resource_type: type });
  } catch (err) {
    console.error(`Failed to delete ${type} from Cloudinary:`, err);
  }
}

const productBody = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim(),
  description: z.string().min(1, 'Description is required').trim(),
  price: z.number().int('Price must be an integer (cents)').min(0),
  compareAtPrice: z.number().int().min(0).optional().nullable(),
  category: z.string().min(1, 'Category is required'),
  stock: z.number().int().min(0),
  images: z
    .array(
      z.object({
        url: z.string(),
        publicId: z.string().min(1),
        type: z.enum(['image', 'video']).optional().default('image'),
      })
    )
    .optional()
    .default([]),
  
  // Optional DummyJSON attributes
  brand: z.string().trim().optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
  discountPercentage: z.number().min(0).max(100).optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  availabilityStatus: z.string().trim().optional().nullable(),
  shippingInformation: z.string().trim().optional().nullable(),
  returnPolicy: z.string().trim().optional().nullable(),
  warrantyInformation: z.string().trim().optional().nullable(),
  minimumOrderQuantity: z.number().int().min(1).optional().nullable(),
  reviews: z
    .array(
      z.object({
        rating: z.number().min(0).max(5),
        comment: z.string().trim(),
        date: z.preprocess((val) => (val ? new Date(val as any) : new Date()), z.date()).optional(),
        reviewerName: z.string().trim(),
      })
    )
    .optional()
    .default([]),
  featured: z.boolean().optional().default(false),
  bestSeller: z.boolean().optional().default(false),
  trending: z.boolean().optional().default(false),
  newArrival: z.boolean().optional().default(false),
  onSale: z.boolean().optional().default(false),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  q: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(['price_asc', 'price_desc', 'newest', 'oldest', 'rating_desc']).default('newest'),
  brand: z.string().optional(),
  availability: z.enum(['all', 'in-stock', 'out-of-stock']).optional(),
  rating: z.coerce.number().min(0).optional(),
  onlyDiscounted: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
});

export async function getProducts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid query parameters' });
      return;
    }

    const { page, limit, category, q, minPrice, maxPrice, sort, brand, availability, rating, onlyDiscounted } = parsed.data;

    const filter: Record<string, any> = { isDeleted: false };

    if (category) filter.category = category;
    if (brand) filter.brand = { $regex: brand, $options: 'i' };
    if (availability === 'in-stock') {
      filter.stock = { $gt: 0 };
    } else if (availability === 'out-of-stock') {
      filter.stock = 0;
    }
    if (rating !== undefined) {
      filter.rating = { $gte: rating };
    }
    if (onlyDiscounted) {
      filter.compareAtPrice = { $exists: true, $ne: null };
      filter.$expr = { $gt: ['$compareAtPrice', '$price'] };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) (filter.price as Record<string, number>).$gte = minPrice;
      if (maxPrice !== undefined) (filter.price as Record<string, number>).$lte = maxPrice;
    }

    if (q) {
      const categoryIds = await Category.find({
        name: { $regex: q, $options: 'i' },
        isDeleted: false
      }).distinct('_id');

      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { brand: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } },
        { category: { $in: categoryIds } }
      ];
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      rating_desc: { rating: -1 },
    };

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .sort(sortMap[sort])
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('category', 'name slug')
      .lean();

    res.json({
      success: true,
      data: products,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
}

export async function getProductBySlug(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const product = await Product.findOne({ slug: req.params.slug, isDeleted: false })
      .populate('category', 'name slug')
      .lean();

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function getProductById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const product = await Product.findOne({ _id: req.params.id, isDeleted: false })
      .populate('category', 'name slug')
      .lean();

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function createProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = productBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const data = parsed.data;
    const baseSlug = slugify(data.name);
    const conflict = await Product.findOne({ slug: baseSlug });
    const slug = conflict ? `${baseSlug}-${Date.now()}` : baseSlug;

    const product = await Product.create({ ...data, slug });
    const populated = await product.populate('category', 'name slug');
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = productBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const product = await Product.findOne({ _id: req.params.id, isDeleted: false });
    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    const data = parsed.data;

    // Cloudinary cleanup for removed media
    const oldMedia = product.images || [];
    const newMediaPublicIds = new Set((data.images || []).map((img: any) => img.publicId));
    
    for (const oldItem of oldMedia) {
      if (oldItem.publicId && !newMediaPublicIds.has(oldItem.publicId)) {
        await deleteFromCloudinary(oldItem.publicId, oldItem.type || 'image');
      }
    }

    if (data.name !== product.name) {
      const baseSlug = slugify(data.name);
      const conflict = await Product.findOne({ slug: baseSlug, _id: { $ne: product._id } });
      product.slug = conflict ? `${baseSlug}-${Date.now()}` : baseSlug;
    }

    Object.assign(product, data);
    await product.save();
    const populated = await product.populate('category', 'name slug');
    res.json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
}

export async function updateStock(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stock = Number(req.body.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      return next(new AppError('Stock must be a non-negative integer', 400));
    }

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { stock },
      { new: true }
    ).lean();

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const product = await Product.findOne({ _id: req.params.id, isDeleted: false });
    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    product.isDeleted = true;
    await product.save();
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
}

export async function createOrUpdateProductReview(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const productId = req.params.id;
    const { rating, title, comment, images } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
      return;
    }
    if (!comment || comment.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Comment is required' });
      return;
    }

    const product = await Product.findOne({ _id: productId, isDeleted: false });
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    const userId = req.user._id;
    const userName = req.user.name;
    const userIdStr = userId.toString();

    // Check if the user purchased this product for verifiedPurchase flag
    const hasOrdered = await Order.exists({
      user: userId,
      status: { $ne: 'cancelled' },
      'items.product': productId
    });
    const verifiedPurchase = !!hasOrdered;

    const existingReviewIndex = (product.reviews || []).findIndex(
      (r: any) => r.user && r.user.toString() === userIdStr
    );

    const reviewData = {
      user: userId,
      reviewerName: userName,
      rating: Number(rating),
      title: title ? title.trim() : '',
      comment: comment.trim(),
      images: images || [],
      date: new Date(),
      verifiedPurchase
    };

    if (existingReviewIndex !== -1) {
      // Update existing review
      if (product.reviews) {
        product.reviews[existingReviewIndex] = reviewData as any;
      }
    } else {
      // Create new review
      if (!product.reviews) product.reviews = [];
      product.reviews.push(reviewData as any);
    }

    // Automatically update rating and reviewCount
    const totalReviews = product.reviews ? product.reviews.length : 0;
    const averageRating = totalReviews > 0
      ? Number((product.reviews!.reduce((sum: number, r: any) => sum + r.rating, 0) / totalReviews).toFixed(2))
      : 0;

    product.rating = averageRating;
    product.reviewCount = totalReviews;

    await product.save();

    res.status(201).json({
      success: true,
      data: product.reviews,
      rating: product.rating,
      reviewCount: product.reviewCount,
    });
  } catch (err) {
    next(err);
  }
}

export async function getProductReviews(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const product = await Product.findOne({ _id: req.params.id, isDeleted: false }).lean();
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    // Return reviews list sorted by date descending (newest first)
    const reviews = (product.reviews || []).sort((a: any, b: any) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    res.json({
      success: true,
      data: reviews,
    });
  } catch (err) {
    next(err);
  }
}
