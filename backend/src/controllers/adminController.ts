import { Request, Response, NextFunction } from 'express';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { Order } from '../models/Order';
import { AppError } from '../middleware/AppError';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';

const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

export async function getStats(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const [totalProducts, totalCategories, totalOrders, revenueResult, recentOrders] =
      await Promise.all([
        Product.countDocuments({ isDeleted: false }),
        Category.countDocuments({ isDeleted: false }),
        Order.countDocuments(),
        Order.aggregate([
          { $match: { status: { $ne: 'cancelled' } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
        Order.find()
          .sort({ createdAt: -1 })
          .limit(8)
          .populate('user', 'name email')
          .lean(),
      ]);

    res.json({
      success: true,
      data: {
        totalProducts,
        totalCategories,
        totalOrders,
        totalRevenue: (revenueResult[0]?.total as number) ?? 0,
        recentOrders,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getOrders(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const status = req.query.status as string | undefined;

    const filter: Record<string, unknown> = {};
    if (status && VALID_STATUSES.includes(status)) {
      filter.status = status;
    }

    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name email')
      .lean();

    res.json({
      success: true,
      data: orders,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { status } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) {
      return next(new AppError('Invalid status value', 400));
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )
      .populate('user', 'name email')
      .lean();

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function getAllReviews(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const search = req.query.search as string | undefined;
    const rating = req.query.rating ? Number(req.query.rating) : undefined;
    const verified = req.query.verifiedPurchase !== undefined
      ? req.query.verifiedPurchase === 'true'
      : undefined;
    const productId = req.query.productId as string | undefined;

    // Use aggregation to unwind and query reviews across all products
    const pipeline: any[] = [
      { $match: { isDeleted: false } },
      { $unwind: '$reviews' },
    ];

    // Filters
    const matchFilters: Record<string, any> = {};

    if (rating !== undefined && !isNaN(rating)) {
      matchFilters['reviews.rating'] = rating;
    }
    if (verified !== undefined) {
      matchFilters['reviews.verifiedPurchase'] = verified;
    }
    if (productId) {
      matchFilters._id = new mongoose.Types.ObjectId(productId);
    }
    if (search) {
      // Search by reviewerName, title, or comment
      matchFilters.$or = [
        { 'reviews.reviewerName': { $regex: search, $options: 'i' } },
        { 'reviews.title': { $regex: search, $options: 'i' } },
        { 'reviews.comment': { $regex: search, $options: 'i' } },
      ];
    }

    if (Object.keys(matchFilters).length > 0) {
      pipeline.push({ $match: matchFilters });
    }

    // Projects fields, maps product title/id
    pipeline.push({
      $project: {
        _id: 0,
        reviewId: '$reviews._id',
        productName: '$name',
        productId: '$_id',
        user: '$reviews.user',
        reviewerName: '$reviews.reviewerName',
        rating: '$reviews.rating',
        title: '$reviews.title',
        comment: '$reviews.comment',
        date: '$reviews.date',
        verifiedPurchase: '$reviews.verifiedPurchase',
        images: '$reviews.images',
      }
    });

    // Pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Product.aggregate(countPipeline);
    const total = countResult[0]?.total ?? 0;

    pipeline.push({ $sort: { date: -1 } });
    pipeline.push({ $skip: (page - 1) * limit });
    pipeline.push({ $limit: limit });

    const reviews = await Product.aggregate(pipeline);

    res.json({
      success: true,
      data: reviews,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteReview(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { reviewId } = req.params;

    const product = await Product.findOne({ 'reviews._id': reviewId });
    if (!product) {
      res.status(404).json({ success: false, message: 'Review not found' });
      return;
    }

    const reviewToDelete = product.reviews?.find((r: any) => r._id.toString() === reviewId);
    if (reviewToDelete && reviewToDelete.images && reviewToDelete.images.length > 0) {
      for (const img of reviewToDelete.images) {
        if (img.publicId && !img.publicId.startsWith('dummyjson_')) {
          try {
            await cloudinary.uploader.destroy(img.publicId);
          } catch (e) {
            console.error('Failed to delete review image from Cloudinary:', e);
          }
        }
      }
    }

    if (product.reviews) {
      product.reviews = product.reviews.filter((r: any) => r._id.toString() !== reviewId) as any;
    }

    // Automatically update rating and reviewCount
    const totalReviews = product.reviews ? product.reviews.length : 0;
    const averageRating = totalReviews > 0
      ? Number((product.reviews!.reduce((sum: number, r: any) => sum + r.rating, 0) / totalReviews).toFixed(2))
      : 0;

    product.rating = averageRating;
    product.reviewCount = totalReviews;

    await product.save();

    res.json({ success: true, message: 'Review deleted successfully' });
  } catch (err) {
    next(err);
  }
}
