import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Product } from '../models/Product';
import { AppError } from '../middleware/AppError';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const productBody = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim(),
  description: z.string().min(1, 'Description is required').trim(),
  price: z.number().int('Price must be an integer (cents)').min(0),
  compareAtPrice: z.number().int().min(0).optional(),
  category: z.string().min(1, 'Category is required'),
  stock: z.number().int().min(0),
  images: z
    .array(
      z.object({
        url: z.string().url(),
        publicId: z.string().min(1),
      })
    )
    .optional()
    .default([]),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  q: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(['price_asc', 'price_desc', 'newest', 'oldest']).default('newest'),
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

    const { page, limit, category, q, minPrice, maxPrice, sort } = parsed.data;

    const filter: Record<string, unknown> = { isDeleted: false };

    if (category) filter.category = category;
    if (q) filter.name = { $regex: q, $options: 'i' };
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) (filter.price as Record<string, number>).$gte = minPrice;
      if (maxPrice !== undefined) (filter.price as Record<string, number>).$lte = maxPrice;
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
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
