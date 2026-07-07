import { Request, Response, NextFunction } from 'express';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { Order } from '../models/Order';
import { AppError } from '../middleware/AppError';

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
