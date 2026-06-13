import { describe, it, expect } from 'vitest';

describe('Auth Security Tests', () => {
  it('should validate email format', () => {
    const isValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    expect(isValid('test@example.com')).toBe(true);
    expect(isValid('invalid-email')).toBe(false);
  });

  it('should enforce rate limits correctly', () => {
    const ipLimitMap = new Map<string, number[]>();
    function checkRateLimit(ip: string, limit: number, windowMs: number): boolean {
      const now = Date.now();
      const requests = ipLimitMap.get(ip) || [];
      const recent = requests.filter(t => now - t < windowMs);
      if (recent.length >= limit) return false;
      recent.push(now);
      ipLimitMap.set(ip, recent);
      return true;
    }

    expect(checkRateLimit('127.0.0.1', 2, 60000)).toBe(true);
    expect(checkRateLimit('127.0.0.1', 2, 60000)).toBe(true);
    expect(checkRateLimit('127.0.0.1', 2, 60000)).toBe(false); // Should be rate limited
  });
});
