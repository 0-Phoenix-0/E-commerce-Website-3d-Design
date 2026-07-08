import { Router } from 'express';
import {
  getProducts,
  getProductBySlug,
  getProductById,
  createProduct,
  updateProduct,
  updateStock,
  deleteProduct,
  createOrUpdateProductReview,
  getProductReviews,
} from '../controllers/productController';
import { protect, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

// Public
router.get('/', getProducts);
router.get('/slug/:slug', getProductBySlug);
router.get('/:id/reviews', getProductReviews);

// Protected — reviews CRUD
router.post('/:id/reviews', protect, createOrUpdateProductReview);
router.put('/:id/reviews', protect, createOrUpdateProductReview);

// Admin — specific routes before :id
router.post('/', protect, requireAdmin, createProduct);
router.get('/:id', protect, requireAdmin, getProductById);
router.put('/:id', protect, requireAdmin, updateProduct);
router.patch('/:id/stock', protect, requireAdmin, updateStock);
router.delete('/:id', protect, requireAdmin, deleteProduct);

export default router;
