import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'perpus-secret-key';

export class AuthService {
    async login(email: string, password: string) {
        if (!email || !password) {
            throw { status: 400, message: 'Email and password are required' };
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !user.isActive) {
            throw { status: 401, message: 'Invalid credentials' };
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            throw { status: 401, message: 'Invalid credentials' };
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        return {
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        };
    }

    async getCurrentUser(userId: number) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, role: true },
        });

        if (!user) {
            throw { status: 404, message: 'User not found' };
        }

        return user;
    }
}

export const authService = new AuthService();
