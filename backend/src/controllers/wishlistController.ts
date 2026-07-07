import { Request, Response, NextFunction } from 'express';
import { Wishlist } from '../models/Wishlist';

export async function getWishlist(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user!._id })
      .populate({
        path: 'products',
        match: { isDeleted: false },
        select: 'name slug price compareAtPrice images stock category',
        populate: { path: 'category', select: 'name slug' },
      })
      .lean();

    const products = (wishlist?.products ?? []).filter(Boolean);
    res.json({ success: true, data: products });
  } catch (err) {
    next(err);
  }
}

export async function toggleWishlist(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const productId = req.params.productId;

    let wishlist = await Wishlist.findOne({ user: req.user!._id });
    if (!wishlist) {
      wishlist = new Wishlist({ user: req.user!._id, products: [] });
    }

    const index = wishlist.products.findIndex(
      (p) => p.toString() === productId
    );

    let wishlisted: boolean;
    if (index > -1) {
      wishlist.products.splice(index, 1);
      wishlisted = false;
    } else {
      wishlist.products.push(productId as never);
      wishlisted = true;
    }

    await wishlist.save();
    res.json({ success: true, data: { wishlisted, count: wishlist.products.length } });
  } catch (err) {
    next(err);
  }
}

export async function checkWishlist(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { productId } = req.params;
    const wishlist = await Wishlist.findOne({ user: req.user!._id }).lean();
    const wishlisted =
      wishlist?.products.some((p) => p.toString() === productId) ?? false;
    res.json({ success: true, data: { wishlisted } });
  } catch (err) {
    next(err);
  }
}
