import { Router } from 'express';
import { signUpload } from '../controllers/uploadController';
import { protect, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

router.post('/sign', protect, requireAdmin, signUpload);

export default router;
