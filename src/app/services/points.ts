const POINTS_BALANCE_KEY = 'ai-generator-points-balance';
const POINTS_LEDGER_KEY = 'ai-generator-points-ledger';
const NEWBIE_CLAIMED_KEY = 'ai-generator-points-newbie-claimed';

const BALANCE_PREFIX = `${POINTS_BALANCE_KEY}:`;
const LEDGER_PREFIX = `${POINTS_LEDGER_KEY}:`;
const NEWBIE_PREFIX = `${NEWBIE_CLAIMED_KEY}:`;

const CHECK_IN_PREFIX = 'ai-generator-points-checkin:';

// v2：联网核销 + 绑定账号ID
const ACTIVATION_STATE_KEY_V2 = 'ai-generator-activation-state-v2';
const ACTIVATION_CODE_PREFIX_V2 = 'AIG2';

export type PointsLedgerType = 'earn' | 'spend';

export interface PointsLedgerItem {
  id: string;
  type: PointsLedgerType;
  amount: number;
  title: string;
  timestamp: number;
}

type CheckInState = {
  lastDate?: string;
  count?: number;
};

type ActivationStateV2 = {
  version: 2;
  redeemed: Record<string, { accountId: string; points: number; redeemedAt: number }>;
};

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

function checkInKey(accountId: string) {
  return `${CHECK_IN_PREFIX}${accountId}`;
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

function migrateGuestToDeviceIfNeeded(accountId: string) {
  if (!accountId || !accountId.startsWith('device:')) return;

  // 从旧的 guest 账户平滑迁移到 device:*（避免升级后用户积分“消失”）
  const targetBalanceKey = balanceKey(accountId);
  const guestBalanceKey = balanceKey('guest');

  if (localStorage.getItem(targetBalanceKey) === null && localStorage.getItem(guestBalanceKey) !== null) {
    localStorage.setItem(targetBalanceKey, localStorage.getItem(guestBalanceKey) as string);
  }

  const targetLedgerKey = ledgerKey(accountId);
  const guestLedgerKey = ledgerKey('guest');
  if (localStorage.getItem(targetLedgerKey) === null && localStorage.getItem(guestLedgerKey) !== null) {
    localStorage.setItem(targetLedgerKey, localStorage.getItem(guestLedgerKey) as string);
  }

  const targetNewbieKey = newbieKey(accountId);
  const guestNewbieKey = newbieKey('guest');
  if (localStorage.getItem(targetNewbieKey) === null && localStorage.getItem(guestNewbieKey) !== null) {
    localStorage.setItem(targetNewbieKey, localStorage.getItem(guestNewbieKey) as string);
  }

  const targetCheckInKey = checkInKey(accountId);
  const guestCheckInKey = checkInKey('guest');
  if (localStorage.getItem(targetCheckInKey) === null && localStorage.getItem(guestCheckInKey) !== null) {
    localStorage.setItem(targetCheckInKey, localStorage.getItem(guestCheckInKey) as string);
  }
}

function getBalanceRaw(accountId: string) {
  if (accountId === 'guest') migrateLegacyToGuest();
  migrateGuestToDeviceIfNeeded(accountId);
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
  migrateGuestToDeviceIfNeeded(accountId);
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

function createLedgerId() {
  return `pts-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getCheckInState(accountId: string): CheckInState {
  try {
    const raw = localStorage.getItem(checkInKey(accountId));
    const parsed = raw ? (safeParse<CheckInState>(raw, {}) as any) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    return {
      lastDate: typeof parsed.lastDate === 'string' ? parsed.lastDate : undefined,
      count: Number.isFinite(Number(parsed.count)) ? Math.floor(Number(parsed.count)) : undefined,
    };
  } catch {
    return {};
  }
}

function setCheckInState(accountId: string, next: CheckInState) {
  try {
    localStorage.setItem(checkInKey(accountId), JSON.stringify(next));
  } catch {
    // ignore
  }
}

function getActivationStateV2(): ActivationStateV2 {
  try {
    const raw = localStorage.getItem(ACTIVATION_STATE_KEY_V2);
    if (!raw) return { version: 2, redeemed: {} };
    const parsed = JSON.parse(raw) as any;
    if (parsed && parsed.version === 2 && parsed.redeemed && typeof parsed.redeemed === 'object') {
      return parsed as ActivationStateV2;
    }
    return { version: 2, redeemed: {} };
  } catch {
    return { version: 2, redeemed: {} };
  }
}

function setActivationStateV2(next: ActivationStateV2): void {
  try {
    localStorage.setItem(ACTIVATION_STATE_KEY_V2, JSON.stringify(next));
  } catch {
    // ignore
  }
}

type RedeemResultV2Online =
  | { ok: true; id: string; points: number; redeemedAt: number; alreadyRedeemed: boolean }
  | { ok: false; message: string };

async function redeemActivationCodeV2Online(rawCode: string, accountId: string): Promise<RedeemResultV2Online> {
  const code = rawCode.replace(/\s+/g, '').trim();
  if (!code) return { ok: false, message: '请输入激活码' };

  const resp = await fetch('/api/license/redeem', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, accountId }),
  });

  if (resp.status === 404 || resp.status === 405) {
    return { ok: false, message: '当前环境未连接兑换服务，请使用已部署环境' };
  }

  const data = (await resp.json().catch(() => null)) as any;

  if (!resp.ok || !data || typeof data !== 'object') {
    const msg = typeof data?.message === 'string' ? data.message : '兑换失败，请重试';
    return { ok: false, message: msg };
  }

  if (!data.ok) {
    const msg = typeof data?.message === 'string' ? data.message : '兑换失败，请重试';
    return { ok: false, message: msg };
  }

  const id = typeof data.id === 'string' ? data.id : '';
  const points = Number(data.points);
  const redeemedAt = Number(data.redeemedAt);
  const alreadyRedeemed = Boolean(data.alreadyRedeemed);

  if (!id || !Number.isFinite(points) || points <= 0) {
    return { ok: false, message: '兑换失败（返回数据不完整）' };
  }

  return {
    ok: true,
    id,
    points: Math.floor(points),
    redeemedAt: Number.isFinite(redeemedAt) && redeemedAt > 0 ? Math.floor(redeemedAt) : Date.now(),
    alreadyRedeemed,
  };
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
      id: createLedgerId(),
      type: 'earn',
      amount: delta,
      title,
      timestamp: Date.now(),
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
      id: createLedgerId(),
      type: 'spend',
      amount: need,
      title,
      timestamp: Date.now(),
    });
    return { ok: true as const, balance: current - need };
  },

  hasClaimedNewbie(accountId = 'guest') {
    try {
      if (accountId === 'guest') migrateLegacyToGuest();
      migrateGuestToDeviceIfNeeded(accountId);
      return localStorage.getItem(newbieKey(accountId)) === '1';
    } catch {
      return false;
    }
  },

  claimNewbiePack(accountId = 'guest') {
    if (accountId === 'guest') migrateLegacyToGuest();
    migrateGuestToDeviceIfNeeded(accountId);
    const claimed = localStorage.getItem(newbieKey(accountId)) === '1';
    if (claimed) return { ok: false as const };
    localStorage.setItem(newbieKey(accountId), '1');
    this.earnPoints(accountId, 5, '新手礼包');
    return { ok: true as const };
  },

  checkIn(accountId = 'guest'): { ok: boolean; balance: number; reason?: 'already' | 'limit' } {
    if (accountId === 'guest') migrateLegacyToGuest();
    migrateGuestToDeviceIfNeeded(accountId);
    const today = new Date().toLocaleDateString('zh-CN');
    const st = getCheckInState(accountId);

    const used = st.count ?? 0;
    if (used >= 7) return { ok: false, balance: this.getBalance(accountId), reason: 'limit' };
    if (st.lastDate === today) return { ok: false, balance: this.getBalance(accountId), reason: 'already' };

    const nextCount = used + 1;
    setCheckInState(accountId, { lastDate: today, count: nextCount });
    this.earnPoints(accountId, 3, '每日签到');
    return { ok: true, balance: this.getBalance(accountId) };
  },

  async redeemActivationCode(accountId: string, code: string): Promise<{ ok: boolean; message: string; addedPoints?: number }> {
    const normalized = code.replace(/\s+/g, '').trim();
    if (!normalized) return { ok: false, message: '请输入激活码' };

    const prefix = normalized.split('.')[0] ?? '';
    if (prefix !== ACTIVATION_CODE_PREFIX_V2) {
      return { ok: false, message: '激活码格式不正确' };
    }

    const online = await redeemActivationCodeV2Online(normalized, accountId);
    if (!online.ok) return online;

    const state = getActivationStateV2();

    // 已入账（本机）
    if (state.redeemed[online.id]) {
      return { ok: true, message: '该激活码已兑换（本机已入账）' };
    }

    // 已核销但本机未记录：为了防止重复加分，这里不再补入账
    if (online.alreadyRedeemed) {
      return { ok: false, message: '该激活码已被该账号兑换过（可能已在其他设备或已清理数据）' };
    }

    const points = online.points;
    if (points > 0) {
      this.earnPoints(accountId, points, `激活码兑换 +${points}（${online.id}）`);
    }

    const next: ActivationStateV2 = {
      version: 2,
      redeemed: {
        ...state.redeemed,
        [online.id]: { accountId, points, redeemedAt: online.redeemedAt },
      },
    };
    setActivationStateV2(next);

    return {
      ok: true,
      message: points > 0 ? `兑换成功 +${points} 积分` : '兑换成功',
      addedPoints: points,
    };
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
      if (
        key.startsWith(BALANCE_PREFIX) ||
        key.startsWith(LEDGER_PREFIX) ||
        key.startsWith(NEWBIE_PREFIX) ||
        key.startsWith(CHECK_IN_PREFIX)
      ) {
        toDelete.push(key);
      }
    }
    toDelete.forEach((k) => localStorage.removeItem(k));
  },
};
