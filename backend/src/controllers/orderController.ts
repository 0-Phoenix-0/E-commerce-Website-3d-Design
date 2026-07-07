import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Order } from '../models/Order';
import { Cart } from '../models/Cart';
import { Product } from '../models/Product';
import { AppError } from '../middleware/AppError';

const shippingAddressSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').trim(),
  addressLine1: z.string().min(1, 'Address is required').trim(),
  addressLine2: z.string().trim().optional(),
  city: z.string().min(1, 'City is required').trim(),
  state: z.string().min(1, 'State is required').trim(),
  postalCode: z.string().min(1, 'Postal code is required').trim(),
  country: z.string().min(1, 'Country is required').trim(),
});

const createOrderSchema = z.object({
  shippingAddress: shippingAddressSchema,
});

export async function createOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    // Load the user's cart with populated products
    const cart = await Cart.findOne({ user: req.user!._id }).populate({
      path: 'items.product',
      match: { isDeleted: false },
      select: 'name price images stock',
    });

    if (!cart || cart.items.length === 0) {
      return next(new AppError('Your cart is empty', 400));
    }

    // Filter items whose product still exists
    const validItems = cart.items.filter((item) => item.product != null);
    if (validItems.length === 0) {
      return next(new AppError('All items in your cart are unavailable', 400));
    }

    for (const item of validItems) {
      const product = item.product as unknown as { stock: number; name: string };
      if (product.stock < item.quantity) {
        return next(new AppError(`Insufficient stock for "${product.name}"`, 400));
      }
    }

    // Build order items snapshot & calculate total
    let totalAmount = 0;
    const orderItems = validItems.map((item) => {
      const p = item.product as unknown as {
        _id: string;
        name: string;
        price: number;
        images: { url: string }[];
      };
      const lineTotal = p.price * item.quantity;
      totalAmount += lineTotal;
      return {
        product: p._id,
        name: p.name,
        imageUrl: p.images[0]?.url ?? '',
        price: p.price,
        quantity: item.quantity,
      };
    });

    // Decrement stock for each item
    for (const item of validItems) {
      const p = item.product as unknown as { _id: string };
      await Product.findByIdAndUpdate(p._id, { $inc: { stock: -item.quantity } });
    }

    // Create the order
    const order = await Order.create({
      user: req.user!._id,
      items: orderItems,
      totalAmount,
      shippingAddress: parsed.data.shippingAddress,
      status: 'pending',
    });

    // Clear the cart
    cart.items = [];
    await cart.save();

    const populated = await order.populate('user', 'name email');
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
}

export async function getMyOrders(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));

    const filter = { user: req.user!._id };
    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
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

export async function getMyOrderById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user!._id,
    }).lean();

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}
