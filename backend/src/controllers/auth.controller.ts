import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { AuthRequest } from '../middleware/auth';
import { logAudit, getClientInfo } from '../utils/auditLog';

export class AuthController {
    /**
     * @openapi
     * /api/auth/login:
     *   post:
     *     summary: Login to the system
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               email:
     *                 type: string
     *               password:
     *                 type: string
     *     responses:
     *       200:
     *         description: Login successful
     *       401:
     *         description: Invalid credentials
     */
    async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            const result = await authService.login(email, password);

            // Log successful login
            const clientInfo = getClientInfo(req);
            await logAudit({
                userId: result.user.id,
                action: 'LOGIN',
                entity: 'User',
                entityId: result.user.id,
                details: { email: result.user.email, role: result.user.role },
                ...clientInfo,
            });

            return res.json(result);
        } catch (error: any) {
            console.error('Login error:', error);
            const status = error.status || 500;
            const message = error.message || 'Login failed';
            return res.status(status).json({ error: message });
        }
    }

    /**
     * @openapi
     * /api/auth/me:
     *   get:
     *     summary: Get current authenticated user info
     *     tags: [Auth]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Current user data
     *       401:
     *         description: Unauthorized
     */
    async me(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const user = await authService.getCurrentUser(userId);
            return res.json(user);
        } catch (error: any) {
            const status = error.status || 500;
            const message = error.message || 'Failed to get user';
            return res.status(status).json({ error: message });
        }
    }
}

export const authController = new AuthController();
