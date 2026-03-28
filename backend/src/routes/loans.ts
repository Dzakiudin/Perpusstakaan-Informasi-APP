import { Router } from 'express';
import { authMiddleware, pustakawanOrAdmin } from '../middleware/auth';
import { loanController } from '../controllers/loan.controller';

const router: Router = Router();

// Routes using controller
router.get('/', authMiddleware, loanController.getAll);
router.get('/history', authMiddleware, loanController.getHistory);
router.get('/status/overdue', authMiddleware, loanController.getOverdue);
router.get('/:id', authMiddleware, loanController.getById);

// Transactions
router.post('/', authMiddleware, pustakawanOrAdmin, loanController.create);
router.post('/return', authMiddleware, pustakawanOrAdmin, loanController.returnItems);

export default router;
