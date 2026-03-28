import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { authController } from '../controllers/auth.controller';

const router: Router = Router();

// Login
router.post('/login', authController.login);

// Get current user
router.get('/me', authMiddleware, authController.me as any);

export default router;
