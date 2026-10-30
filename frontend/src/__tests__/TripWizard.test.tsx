import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NewTripPage } from '../pages/NewTripPage';
import { AuthContext } from '../contexts/AuthContext';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const mockAuthContext = {
  user: { id: 'test-user-123', email: 'traveler@example.com' } as any,
  session: null,
  accessToken: 'mock-token',
  isLoading: false,
  isSupabaseConfigured: true,
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  resetPassword: vi.fn(),
  signOut: vi.fn(),
};

function renderWizard() {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={mockAuthContext}>
        <BrowserRouter>
          <NewTripPage />
        </BrowserRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

describe('Smart Trip Builder Multi-Step Wizard', () => {
  it('renders Step 1 (Basics) with destination and title inputs', () => {
    renderWizard();

    expect(screen.getByText(/Smart Trip Builder/i)).toBeInTheDocument();
    expect(screen.getByText(/Where and when are you going\?/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Barcelona, Spain/i)).toBeInTheDocument();
    expect(screen.getByText(/Next Step/i)).toBeInTheDocument();
  });

  it('renders quick presets that configure travel options', () => {
    renderWizard();

    const soloPreset = screen.getByText(/Weekend Getaway/i);
    expect(soloPreset).toBeInTheDocument();

    const romanticPreset = screen.getByText(/Romantic Escape/i);
    expect(romanticPreset).toBeInTheDocument();

    const groupPreset = screen.getByText(/Friends Adventure/i);
    expect(groupPreset).toBeInTheDocument();

    // Clicking group preset updates state
    fireEvent.click(groupPreset);
    expect(screen.getByDisplayValue(/Tokyo Neon & Shrines Expedition/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Tokyo, Japan/i)).toBeInTheDocument();
  });

  it('validates required fields before proceeding to the next step', () => {
    renderWizard();

    // Clear destination if preset filled it
    const destInput = screen.getByPlaceholderText(/Barcelona, Spain/i);
    fireEvent.change(destInput, { target: { value: '' } });

    const nextButton = screen.getByText(/Next Step/i);
    fireEvent.click(nextButton);

    // Validation triggers error and prevents advancing
    expect(screen.getByText(/Please enter a valid destination/i)).toBeInTheDocument();
    expect(screen.getByText(/Where and when are you going\?/i)).toBeInTheDocument();
  });
});
