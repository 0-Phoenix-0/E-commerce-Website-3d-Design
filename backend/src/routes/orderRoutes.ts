import { Router } from 'express';
import { createOrder, getMyOrders, getMyOrderById, verifyPayment } from '../controllers/orderController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.use(protect);

router.post('/', createOrder);
router.post('/:id/verify-payment', verifyPayment);
router.get('/my', getMyOrders);
router.get('/my/:id', getMyOrderById);

export default router;
