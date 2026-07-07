import { Router } from 'express';
import { getWishlist, toggleWishlist, checkWishlist } from '../controllers/wishlistController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.use(protect);

router.get('/', getWishlist);
router.get('/check/:productId', checkWishlist);
router.post('/:productId', toggleWishlist);

export default router;
