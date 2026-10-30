import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LandingPage } from '../pages/LandingPage';
import { AuthContext } from '../contexts/AuthContext';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const unauthenticatedContext = {
  user: null,
  session: null,
  accessToken: null,
  isLoading: false,
  isSupabaseConfigured: false,
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  resetPassword: vi.fn(),
  signOut: vi.fn(),
};

const authenticatedContext = {
  ...unauthenticatedContext,
  user: { id: 'test-user-id', email: 'traveler@wandr.ai' } as any,
};

function renderLanding(authContext = unauthenticatedContext) {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authContext}>
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

describe('LandingPage "Explore Itinerary Builder" Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Explore Itinerary Builder" button in hero section', () => {
    renderLanding();
    const exploreBtn = screen.getByRole('button', { name: /explore itinerary builder/i });
    expect(exploreBtn).toBeInTheDocument();
  });

  it('navigates to /login with return state when user is not logged in', () => {
    renderLanding(unauthenticatedContext);
    const exploreBtn = screen.getByRole('button', { name: /explore itinerary builder/i });
    fireEvent.click(exploreBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/login', {
      state: { from: { pathname: '/trips/new' } },
    });
  });

  it('navigates directly to /trips/new when user is logged in', () => {
    renderLanding(authenticatedContext);
    const exploreBtn = screen.getByRole('button', { name: /explore itinerary builder/i });
    fireEvent.click(exploreBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/trips/new');
  });

  it('renders top navbar with Sign In button when logged out and Dashboard when logged in', () => {
    const { unmount } = renderLanding(unauthenticatedContext);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    unmount();

    renderLanding(authenticatedContext);
    expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument();
  });
});
