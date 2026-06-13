import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Home from '../src/app/page';

// Mock Next.js router and search params
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      prefetch: () => null
    };
  },
  useSearchParams() {
    return {
      get: () => null
    };
  }
}));

describe('Aura Wellness Dashboard', () => {
  it('renders the branding and description correctly', () => {
    render(<Home />);
    
    // Check if branding is present
    expect(screen.getByText('Aura')).toBeDefined();
    expect(screen.getByText('Your Academic Resilience Coach')).toBeDefined();
  });

  it('renders the interactive Orb for voice communication', () => {
    render(<Home />);
    
    const orbContainer = screen.getByRole('button', { name: /Tap the orb to start speaking/i });
    expect(orbContainer).toBeDefined();
    expect(orbContainer.getAttribute('tabIndex')).toBe('0');
  });

  it('toggles listening state when Orb is clicked', () => {
    render(<Home />);
    
    const orbContainer = screen.getByRole('button', { name: /Tap the orb to start speaking/i });
    fireEvent.click(orbContainer);
    
    // After click, aria-label should update
    expect(orbContainer.getAttribute('aria-label')).toBe('Stop listening and analyze');
  });
});