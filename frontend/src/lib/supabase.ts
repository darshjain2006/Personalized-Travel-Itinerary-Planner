import { createClient, type SupabaseClient, type User, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon-key')
);

// Fallback in-memory/localStorage mock client when Supabase cloud is not configured
class MockAuthClient {
  private listeners: Array<(event: string, session: Session | null) => void> = [];
  private currentSession: Session | null = null;

  constructor() {
    const saved = localStorage.getItem('mock_supabase_session');
    if (saved) {
      try {
        this.currentSession = JSON.parse(saved);
      } catch {
        this.currentSession = null;
      }
    }
  }

  private notify(event: string) {
    this.listeners.forEach((cb) => cb(event, this.currentSession));
  }

  async getSession() {
    return { data: { session: this.currentSession }, error: null };
  }

  async getUser() {
    return { data: { user: this.currentSession?.user || null }, error: null };
  }

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    this.listeners.push(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners = this.listeners.filter((l) => l !== callback);
          },
        },
      },
    };
  }

  async signInWithPassword({ email, password: _password }: { email: string; password?: string }) {
    if (!email) {
      return { data: { user: null, session: null }, error: { message: 'Email is required' } };
    }
    const userId = '11111111-1111-1111-1111-111111111111';
    const user: User = {
      id: userId,
      app_metadata: { provider: 'email' },
      user_metadata: {
        full_name: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email,
      phone: '',
      role: 'authenticated',
      updated_at: new Date().toISOString(),
    };

    // Construct mock JWT format: header.payload.sig
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        sub: userId,
        email,
        role: 'authenticated',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 86400,
        user_metadata: user.user_metadata,
      })
    );
    const mockToken = `${header}.${payload}.mock-signature-traveler`;

    const session: Session = {
      access_token: mockToken,
      token_type: 'bearer',
      expires_in: 86400,
      refresh_token: 'mock-refresh-token',
      user,
      expires_at: Math.floor(Date.now() / 1000) + 86400,
    };

    this.currentSession = session;
    localStorage.setItem('mock_supabase_session', JSON.stringify(session));
    this.notify('SIGNED_IN');
    return { data: { user, session }, error: null };
  }

  async signUp({ email, options: _options }: { email: string; password?: string; options?: { data?: Record<string, unknown> } }) {
    return this.signInWithPassword({ email, password: 'password' });
  }

  async signInWithOAuth({ provider }: { provider: string }) {
    const email = `traveler.${provider}@wanderlust.ai`;
    return this.signInWithPassword({ email });
  }

  async resetPasswordForEmail(email: string) {
    if (!email) {
      return { data: null, error: { message: 'Email address is required' } };
    }
    return { data: {}, error: null };
  }

  async signOut() {
    this.currentSession = null;
    localStorage.removeItem('mock_supabase_session');
    this.notify('SIGNED_OUT');
    return { error: null };
  }
}

// Instantiate either real Supabase or our smooth offline mock
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (({ auth: new MockAuthClient() } as unknown) as SupabaseClient);
