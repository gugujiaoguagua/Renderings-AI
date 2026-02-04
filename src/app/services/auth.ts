const AUTH_KEY = 'ai-generator-auth-user';

export type AuthProvider = 'wechat' | 'phone';

export interface AuthUser {
  provider: AuthProvider;
  id: string;
  displayName: string;
  avatarSeed?: string;
}

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function getUserRaw(): AuthUser | null {
  const parsed = safeParse<AuthUser>(localStorage.getItem(AUTH_KEY));
  if (!parsed) return null;
  if (!parsed.id || !parsed.provider || !parsed.displayName) return null;
  return parsed;
}

function setUserRaw(user: AuthUser | null) {
  if (!user) {
    localStorage.removeItem(AUTH_KEY);
    return;
  }
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\s+/g, '');
  if (!/^1\d{10}$/.test(digits)) return null;
  return digits;
}

export const authService = {
  getCurrentUser(): AuthUser | null {
    try {
      return getUserRaw();
    } catch {
      return null;
    }
  },

  getAccountId(): string {
    const user = this.getCurrentUser();
    if (!user) return 'guest';
    return `${user.provider}:${user.id}`;
  },

  loginWeChat(): AuthUser {
    const user: AuthUser = {
      provider: 'wechat',
      id: 'demo',
      displayName: '微信用户',
      avatarSeed: 'wechat-demo'
    };
    setUserRaw(user);
    return user;
  },

  loginPhone(phone: string): AuthUser | null {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    const user: AuthUser = {
      provider: 'phone',
      id: normalized,
      displayName: `手机用户 ${normalized.slice(-4)}`,
      avatarSeed: `phone-${normalized}`
    };
    setUserRaw(user);
    return user;
  },

  logout() {
    setUserRaw(null);
  }
};
