import { Router } from 'express';
import { createOrder, getMyOrders, getMyOrderById } from '../controllers/orderController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.use(protect);

router.post('/', createOrder);
router.get('/my', getMyOrders);
router.get('/my/:id', getMyOrderById);

export default router;
