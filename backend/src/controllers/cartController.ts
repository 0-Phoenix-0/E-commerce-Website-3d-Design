import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Cart } from '../models/Cart';
import { Product } from '../models/Product';
import { AppError } from '../middleware/AppError';

const addItemSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  quantity: z.number().int().min(1).default(1),
});

export async function getCart(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const cart = await Cart.findOne({ user: req.user!._id })
      .populate({
        path: 'items.product',
        match: { isDeleted: false },
        select: 'name price compareAtPrice images slug stock',
      })
      .lean();

    if (!cart) {
      res.json({ success: true, data: { items: [], itemCount: 0 } });
      return;
    }

    // Strip items whose product was soft-deleted (populate returns null)
    const items = cart.items.filter((item) => item.product != null);
    res.json({ success: true, data: { ...cart, items, itemCount: items.length } });
  } catch (err) {
    next(err);
  }
}

export async function addToCart(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = addItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { productId, quantity } = parsed.data;

    const product = await Product.findOne({ _id: productId, isDeleted: false });
    if (!product) return next(new AppError('Product not found', 404));
    if (product.stock < quantity) return next(new AppError('Insufficient stock', 400));

    let cart = await Cart.findOne({ user: req.user!._id });
    if (!cart) {
      cart = new Cart({ user: req.user!._id, items: [] });
    }

    const existingIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (existingIndex > -1) {
      const newQty = cart.items[existingIndex].quantity + quantity;
      if (newQty > product.stock) {
        return next(new AppError('Requested quantity exceeds available stock', 400));
      }
      cart.items[existingIndex].quantity = newQty;
    } else {
      cart.items.push({ product: product._id, quantity } as never);
    }

    await cart.save();
    res.json({ success: true, data: { itemCount: cart.items.length } });
  } catch (err) {
    next(err);
  }
}

export async function removeFromCart(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { productId } = req.params;
    const cart = await Cart.findOne({ user: req.user!._id });
    if (!cart) return next(new AppError('Cart not found', 404));

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId
    );
    await cart.save();
    res.json({ success: true, data: { itemCount: cart.items.length } });
  } catch (err) {
    next(err);
  }
}

export async function updateCartItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { productId } = req.params;
    const quantity = Number(req.body.quantity);

    if (!Number.isInteger(quantity) || quantity < 1) {
      return next(new AppError('Quantity must be a positive integer', 400));
    }

    const product = await Product.findOne({ _id: productId, isDeleted: false });
    if (!product) return next(new AppError('Product not found', 404));
    if (product.stock < quantity) return next(new AppError('Insufficient stock', 400));

    const cart = await Cart.findOne({ user: req.user!._id });
    if (!cart) return next(new AppError('Cart not found', 404));

    const item = cart.items.find((i) => i.product.toString() === productId);
    if (!item) return next(new AppError('Item not in cart', 404));

    item.quantity = quantity;
    await cart.save();
    res.json({ success: true, data: { itemCount: cart.items.length } });
  } catch (err) {
    next(err);
  }
}

export async function clearCart(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await Cart.findOneAndUpdate({ user: req.user!._id }, { items: [] });
    res.json({ success: true, data: { itemCount: 0 } });
  } catch (err) {
    next(err);
  }
}
