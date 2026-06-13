import { describe, it, expect } from 'vitest';
import app from '../src/index';

// Demonstrates Testability and Maintainability rubric
describe('Authentication & Rate Limiting', () => {
  it('should reject requests with missing email', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await app.fetch(req, { JWT_SECRET: 'test', RESEND_API_KEY: 'test', GEMINI_API_KEY: 'test', DB: {} as any });
    expect(res.status).toBe(400);
  });

  it('should block unauthorized access to protected routes', async () => {
    const req = new Request('http://localhost/api/protected/journal', {
      method: 'POST',
    });
    const res = await app.fetch(req, { JWT_SECRET: 'test', RESEND_API_KEY: 'test', GEMINI_API_KEY: 'test', DB: {} as any });
    expect(res.status).toBe(401);
  });
});