import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../services/auth.service';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const mockPrisma = vi.hoisted(() => ({
    user: {
        findUnique: vi.fn(),
    },
}));

// Minimal mock for Prisma
vi.mock('@prisma/client', () => {
    return {
        PrismaClient: class {
            constructor() {
                return mockPrisma;
            }
        },
    };
});

describe('AuthService', () => {
    let authService: AuthService;

    beforeEach(() => {
        authService = new AuthService();
        vi.clearAllMocks();
    });

    it('should return user and token on successful login', async () => {
        const mockUser = { id: 1, email: 'test@example.com', password: 'hashed_password', role: 'admin', isActive: true, name: 'Test User' };

        // Mock findUnique to return our user
        mockPrisma.user.findUnique.mockResolvedValue(mockUser);

        // Mock bcrypt and jwt
        vi.spyOn(bcrypt, 'compare').mockImplementation(async () => true);
        vi.spyOn(jwt, 'sign').mockReturnValue('mock_token' as any);

        const result = await authService.login('test@example.com', 'password');

        expect(result).toHaveProperty('token', 'mock_token');
        expect(result.user).toMatchObject({ id: 1, email: 'test@example.com' });
    });

    it('should throw 401 for invalid credentials', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);

        await expect(authService.login('wrong@example.com', 'password')).rejects.toMatchObject({
            status: 401,
            message: 'Invalid credentials',
        });
    });
});
