import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '../app/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('AuraCompanion Home Page', () => {
  it('renders the landing page correctly', () => {
    render(<Home />);
    
    // Check if branding text is present
    expect(screen.getByText(/Welcome to Aura/i)).toBeInTheDocument();
    
    // Check for magic link input
    expect(screen.getByPlaceholderText(/student@example.com/i)).toBeInTheDocument();
  });
});
