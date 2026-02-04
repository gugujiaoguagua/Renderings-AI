const POINTS_BALANCE_KEY = 'ai-generator-points-balance';
const POINTS_LEDGER_KEY = 'ai-generator-points-ledger';
const NEWBIE_CLAIMED_KEY = 'ai-generator-points-newbie-claimed';

const BALANCE_PREFIX = `${POINTS_BALANCE_KEY}:`;
const LEDGER_PREFIX = `${POINTS_LEDGER_KEY}:`;
const NEWBIE_PREFIX = `${NEWBIE_CLAIMED_KEY}:`;

export type PointsLedgerType = 'earn' | 'spend';

export interface PointsLedgerItem {
  id: string;
  type: PointsLedgerType;
  amount: number;
  title: string;
  timestamp: number;
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function balanceKey(accountId: string) {
  return `${BALANCE_PREFIX}${accountId}`;
}

function ledgerKey(accountId: string) {
  return `${LEDGER_PREFIX}${accountId}`;
}

function newbieKey(accountId: string) {
  return `${NEWBIE_PREFIX}${accountId}`;
}

function migrateLegacyToGuest() {
  const guestBalanceKey = balanceKey('guest');
  const guestLedgerKey = ledgerKey('guest');

  if (localStorage.getItem(guestBalanceKey) === null) {
    const legacyBalance = localStorage.getItem(POINTS_BALANCE_KEY);
    if (legacyBalance !== null) {
      localStorage.setItem(guestBalanceKey, legacyBalance);
      localStorage.removeItem(POINTS_BALANCE_KEY);
    }
  }

  if (localStorage.getItem(guestLedgerKey) === null) {
    const legacyLedger = localStorage.getItem(POINTS_LEDGER_KEY);
    if (legacyLedger !== null) {
      localStorage.setItem(guestLedgerKey, legacyLedger);
      localStorage.removeItem(POINTS_LEDGER_KEY);
    }
  }

  const legacyNewbie = localStorage.getItem(NEWBIE_CLAIMED_KEY);
  if (legacyNewbie !== null) {
    localStorage.setItem(newbieKey('guest'), legacyNewbie);
    localStorage.removeItem(NEWBIE_CLAIMED_KEY);
  }
}

function getBalanceRaw(accountId: string) {
  if (accountId === 'guest') migrateLegacyToGuest();
  const key = balanceKey(accountId);
  const saved = localStorage.getItem(key);
  if (saved === null) {
    localStorage.setItem(key, '20');
    return 20;
  }
  const n = Number(saved);
  return Number.isFinite(n) ? n : 0;
}

function setBalanceRaw(accountId: string, value: number) {
  const next = Math.max(0, Math.floor(value));
  localStorage.setItem(balanceKey(accountId), String(next));
}

function getLedgerRaw(accountId: string): PointsLedgerItem[] {
  if (accountId === 'guest') migrateLegacyToGuest();
  const parsed = safeParse<PointsLedgerItem[]>(localStorage.getItem(ledgerKey(accountId)), []);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((x) => x && typeof x === 'object')
    .filter((x) => typeof (x as PointsLedgerItem).id === 'string')
    .slice(0, 100);
}

function setLedgerRaw(accountId: string, items: PointsLedgerItem[]) {
  localStorage.setItem(ledgerKey(accountId), JSON.stringify(items.slice(0, 100)));
}

function addLedger(accountId: string, item: PointsLedgerItem) {
  const ledger = getLedgerRaw(accountId);
  setLedgerRaw(accountId, [item, ...ledger]);
}

export const pointsService = {
  getBalance(accountId = 'guest'): number {
    try {
      return getBalanceRaw(accountId);
    } catch {
      return 0;
    }
  },

  getLedger(accountId = 'guest', limit = 20): PointsLedgerItem[] {
    try {
      return getLedgerRaw(accountId).slice(0, Math.max(0, Math.floor(limit)));
    } catch {
      return [];
    }
  },

  earnPoints(accountId = 'guest', amount: number, title: string) {
    const delta = Math.max(0, Math.floor(amount));
    if (delta <= 0) return;

    const next = getBalanceRaw(accountId) + delta;
    setBalanceRaw(accountId, next);
    addLedger(accountId, {
      id: `pts-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: 'earn',
      amount: delta,
      title,
      timestamp: Date.now()
    });
  },

  canSpend(accountId = 'guest', amount: number) {
    const need = Math.max(0, Math.floor(amount));
    return getBalanceRaw(accountId) >= need;
  },

  spendPoints(accountId = 'guest', amount: number, title: string) {
    const need = Math.max(0, Math.floor(amount));
    if (need <= 0) return { ok: true as const, balance: getBalanceRaw(accountId) };
    const current = getBalanceRaw(accountId);
    if (current < need) return { ok: false as const, balance: current };

    setBalanceRaw(accountId, current - need);
    addLedger(accountId, {
      id: `pts-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: 'spend',
      amount: need,
      title,
      timestamp: Date.now()
    });
    return { ok: true as const, balance: current - need };
  },

  hasClaimedNewbie(accountId = 'guest') {
    try {
      if (accountId === 'guest') migrateLegacyToGuest();
      return localStorage.getItem(newbieKey(accountId)) === '1';
    } catch {
      return false;
    }
  },

  claimNewbiePack(accountId = 'guest') {
    if (accountId === 'guest') migrateLegacyToGuest();
    const claimed = localStorage.getItem(newbieKey(accountId)) === '1';
    if (claimed) return { ok: false as const };
    localStorage.setItem(newbieKey(accountId), '1');
    this.earnPoints(accountId, 5, '新手礼包');
    return { ok: true as const };
  },

  resetAll() {
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key === POINTS_BALANCE_KEY || key === POINTS_LEDGER_KEY || key === NEWBIE_CLAIMED_KEY) {
        toDelete.push(key);
        continue;
      }
      if (key.startsWith(BALANCE_PREFIX) || key.startsWith(LEDGER_PREFIX) || key.startsWith(NEWBIE_PREFIX)) {
        toDelete.push(key);
      }
    }
    toDelete.forEach((k) => localStorage.removeItem(k));
  }
};
