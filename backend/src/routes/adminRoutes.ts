import { Router } from 'express';
import { getStats, getOrders, updateOrderStatus, getAllReviews, deleteReview } from '../controllers/adminController';
import { protect, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

router.use(protect, requireAdmin);

router.get('/stats', getStats);
router.get('/orders', getOrders);
router.patch('/orders/:id/status', updateOrderStatus);
router.get('/reviews', getAllReviews);
router.delete('/reviews/:reviewId', deleteReview);

export default router;
