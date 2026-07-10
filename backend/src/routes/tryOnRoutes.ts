import { Router } from 'express';
import { signTryOnUpload, createTryOn, getTryOnStatus } from '../controllers/tryOnController';
import { protect } from '../middleware/authMiddleware';
import { tryOnLimiter } from '../middleware/rateLimiter';

const router = Router();

router.use(protect);

router.post('/sign', signTryOnUpload);
router.post('/', tryOnLimiter, createTryOn);
router.get('/:taskId', getTryOnStatus);

export default router;
