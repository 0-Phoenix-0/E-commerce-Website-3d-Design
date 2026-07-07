import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Category } from '../models/Category';
import { AppError } from '../middleware/AppError';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const categoryBody = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
  description: z.string().max(500).trim().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
});

export async function getCategories(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const categories = await Category.find({ isDeleted: false }).sort({ name: 1 }).lean();
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
}

export async function createCategory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = categoryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { name, description, imageUrl } = parsed.data;
    const baseSlug = slugify(name);

    // Ensure slug uniqueness
    let slug = baseSlug;
    const existing = await Category.findOne({ slug });
    if (existing) {
      slug = `${baseSlug}-${Date.now()}`;
    }

    const category = await Category.create({ name, slug, description, imageUrl });
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
}

export async function updateCategory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = categoryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const category = await Category.findById(req.params.id);
    if (!category || category.isDeleted) {
      return next(new AppError('Category not found', 404));
    }

    const { name, description, imageUrl } = parsed.data;

    // Regenerate slug only if name changed
    if (name !== category.name) {
      const baseSlug = slugify(name);
      const conflict = await Category.findOne({ slug: baseSlug, _id: { $ne: category._id } });
      category.slug = conflict ? `${baseSlug}-${Date.now()}` : baseSlug;
    }

    category.name = name;
    if (description !== undefined) category.description = description;
    if (imageUrl !== undefined) category.imageUrl = imageUrl || undefined;

    await category.save();
    res.json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
}

export async function deleteCategory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const category = await Category.findById(req.params.id);
    if (!category || category.isDeleted) {
      return next(new AppError('Category not found', 404));
    }

    category.isDeleted = true;
    await category.save();
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
}
