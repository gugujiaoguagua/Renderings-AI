import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Coins,
  Gift,
  LogOut,
  Smartphone,
  User,
  Shield,
  Trash2,
  HelpCircle,
  MessageSquare,
  ChevronRight,
  Database,
  Copy,
  KeyRound,
  CreditCard,
  List,
  CalendarCheck,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Separator } from '@/app/components/ui/separator';
import { Input } from '@/app/components/ui/input';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/app/components/ui/avatar';
import { storageService } from '@/app/services/storage';
import { pointsService } from '@/app/services/points';
import { authService } from '@/app/services/auth';
import { toast } from 'sonner';

function formatDateTime(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const POINTS_PACKAGES = [
  { priceText: '9.9', points: 100 },
  { priceText: '29.9', points: 300 },
  { priceText: '49.9', points: 520 },
  { priceText: '99', points: 1088 },
] as const;

export function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showPointsDialog, setShowPointsDialog] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  const [phoneValue, setPhoneValue] = useState('');
  const [user, setUser] = useState(authService.getCurrentUser());
  const accountId = useMemo(() => authService.getAccountId(), [user]);

  const [balance, setBalance] = useState(pointsService.getBalance(accountId));
  const [ledger, setLedger] = useState(pointsService.getLedger(accountId, 20));

  const [activationCode, setActivationCode] = useState('');
  const [redeemFeedback, setRedeemFeedback] = useState<null | { ok: boolean; message: string }>(null);
  const [redeemLoading, setRedeemLoading] = useState(false);

  const refreshPoints = (targetAccountId = accountId) => {
    setBalance(pointsService.getBalance(targetAccountId));
    setLedger(pointsService.getLedger(targetAccountId, 20));
  };

  useEffect(() => {
    refreshPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  useEffect(() => {
    if ((location.state as any)?.openPoints) {
      setShowPointsDialog(true);
    }
  }, [location.state]);

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch {
      try {
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        toast.success(successMessage);
      } catch {
        toast.error('复制失败，请手动复制');
      }
    }
  };

  const handleClearCache = () => {
    storageService.clearAllData();
    setShowClearDialog(false);
    toast.success('缓存已清空');
  };

  const handleAdminEntry = () => {
    const secret = '9X#kP2$mQ5@Ln!8zR_vW4 H7&bL@3sK9!dP2#xM5$qN Z1!wR4*yC8(uI3^oP0)tL';
    const input = prompt('请输入进入指令（非后台口令）：');
    if (input === secret) {
      navigate('/admin/license');
    } else if (input !== null) {
      toast.error('指令错误');
    }
  };

  const handleRedeemActivationCode = async () => {
    if (redeemLoading) return;
    setRedeemLoading(true);
    try {
      const res = await pointsService.redeemActivationCode(accountId, activationCode);
      setRedeemFeedback({ ok: res.ok, message: res.message });
      if (res.ok) {
        refreshPoints();
        setActivationCode('');
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } finally {
      setRedeemLoading(false);
    }
  };

  const getCacheSize = () => {
    const recentImages = storageService.getRecentImages();
    const history = storageService.getHistory();
    return {
      images: recentImages.length,
      history: history.length,
    };
  };

  const cacheSize = getCacheSize();
  const pointsSummary = useMemo(() => `${balance} 积分`, [balance]);
  const hasClaimedNewbie = useMemo(() => pointsService.hasClaimedNewbie(accountId), [accountId]);

  const buildPurchaseMessage = (pkg: { priceText: string; points: number }) => {
    return `购买档位：${pkg.priceText} 元 = ${pkg.points} 积分`;
  };

  const handleCopyPurchaseMessage = async (pkg: { priceText: string; points: number }) => {
    await copyText(buildPurchaseMessage(pkg), '购买信息已复制');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}
          >
            <ArrowLeft className="size-4 mr-1" />
            返回
          </Button>
          <h1 className="flex-1 text-center font-semibold">设置与帮助</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <section>
          <h2 className="text-sm font-medium text-gray-700 mb-3">激活码</h2>
          <Card className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium flex items-center gap-2">
                  <KeyRound className="size-4 text-gray-600" />
                  账号ID（用于核销绑定）
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  兑换需要联网；成功后积分会绑定到当前账号ID。请勿随意清理浏览器数据。
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => copyText(accountId, '账号ID已复制')}
              >
                <Copy className="size-4 mr-2" />
                复制
              </Button>
            </div>

            <div className="text-xs font-mono break-all rounded-md border bg-gray-50 p-2 text-gray-700">
              {accountId}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">输入激活码</div>
              <div className="flex gap-3">
                <Input
                  value={activationCode}
                  onChange={(e) => {
                    setRedeemFeedback(null);
                    setActivationCode(e.target.value.slice(0, 2048));
                  }}
                  placeholder="例如：AIG2.xxxxx.yyyyy"
                />
                <Button onClick={handleRedeemActivationCode} disabled={!activationCode.trim() || redeemLoading}>
                  {redeemLoading ? '兑换中…' : '兑换'}
                </Button>
              </div>
              {redeemFeedback && (
                <Alert variant={redeemFeedback.ok ? 'default' : 'destructive'}>
                  <AlertDescription>{redeemFeedback.message}</AlertDescription>
                </Alert>
              )}
              <div className="text-xs text-gray-500">
                如提示“当前环境未连接兑换服务”，请用 Cloudflare Pages 部署环境（或本地 `wrangler pages dev`）再兑换。
              </div>
            </div>
          </Card>
        </section>

        <section>
          <h2 className="text-sm font-medium text-gray-700 mb-3">账号</h2>
          <Card className="divide-y">
            <button
              className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              onClick={() => setShowAuthDialog(true)}
            >
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarFallback className="bg-gray-100">
                    <User className="size-4 text-gray-700" />
                  </AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="font-medium">{user ? user.displayName : '未登录'}</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {user ? (user.provider === 'wechat' ? '微信登录' : '手机号登录') : '未登录时会使用本机账号ID'}
                  </p>
                </div>
              </div>
              <ChevronRight className="size-5 text-gray-400" />
            </button>

            {user && (
              <button
                className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                onClick={() => {
                  authService.logout();
                  setUser(null);
                  toast.success('已退出登录');
                }}
              >
                <div className="flex items-center gap-3">
                  <LogOut className="size-5 text-gray-600" />
                  <div className="text-left">
                    <p className="font-medium">退出登录</p>
                    <p className="text-xs text-gray-600 mt-0.5">切换到本机账号ID</p>
                  </div>
                </div>
                <ChevronRight className="size-5 text-gray-400" />
              </button>
            )}
          </Card>
        </section>

        <section>
          <h2 className="text-sm font-medium text-gray-700 mb-3">积分</h2>
          <Card className="divide-y">
            <button
              className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              onClick={() => {
                refreshPoints();
                setShowPointsDialog(true);
              }}
            >
              <div className="flex items-center gap-3">
                <Coins className="size-5 text-gray-600" />
                <div className="text-left">
                  <p className="font-medium">积分中心</p>
                  <p className="text-xs text-gray-600 mt-0.5">{pointsSummary}</p>
                </div>
              </div>
              <ChevronRight className="size-5 text-gray-400" />
            </button>
          </Card>
        </section>

        <section>
          <h2 className="text-sm font-medium text-gray-700 mb-3">隐私与数据</h2>
          <Card className="divide-y">
            <button
              className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              onClick={() => setShowPrivacyDialog(true)}
            >
              <div className="flex items-center gap-3">
                <Shield className="size-5 text-gray-600" />
                <div className="text-left">
                  <p className="font-medium">隐私说明</p>
                  <p className="text-xs text-gray-600 mt-0.5">了解数据如何使用和存储</p>
                </div>
              </div>
              <ChevronRight className="size-5 text-gray-400" />
            </button>

            <button
              className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              onClick={() => setShowClearDialog(true)}
            >
              <div className="flex items-center gap-3">
                <Database className="size-5 text-gray-600" />
                <div className="text-left">
                  <p className="font-medium">清理缓存</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {cacheSize.images} 张最近图片，{cacheSize.history} 条历史记录
                  </p>
                </div>
              </div>
              <Trash2 className="size-5 text-gray-400" />
            </button>
          </Card>
        </section>

        <section>
          <h2 className="text-sm font-medium text-gray-700 mb-3">帮助与支持</h2>
          <Card className="divide-y">
            <button
              className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              onClick={() => setShowHelpDialog(true)}
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="size-5 text-gray-600" />
                <div className="text-left">
                  <p className="font-medium">常见问题</p>
                  <p className="text-xs text-gray-600 mt-0.5">查看使用帮助和解答</p>
                </div>
              </div>
              <ChevronRight className="size-5 text-gray-400" />
            </button>

            <button
              className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              onClick={() => toast.info('反馈功能即将上线')}
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="size-5 text-gray-600" />
                <div className="text-left">
                  <p className="font-medium">意见反馈</p>
                  <p className="text-xs text-gray-600 mt-0.5">告诉我们你的想法</p>
                </div>
              </div>
              <ChevronRight className="size-5 text-gray-400" />
            </button>
          </Card>
        </section>

        <section>
          <Card className="p-4 text-center space-y-2">
            <p className="text-sm text-gray-600">模型渲染 AI</p>
            <p className="text-xs text-gray-500">版本 1.0.0</p>
            <Separator className="my-2" />
            <p className="text-xs text-gray-500">
              使用先进的 AI 技术，完成模型渲染与图片处理
              <button
                type="button"
                onClick={handleAdminEntry}
                aria-label="admin-entry"
                className="ml-1 inline-block w-6 h-6 align-middle opacity-0"
                title="Admin"
              />
            </p>
          </Card>
        </section>
      </main>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清空所有缓存？</AlertDialogTitle>
            <AlertDialogDescription>
              这将删除：
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>{cacheSize.images} 张最近使用的图片</li>
                <li>{cacheSize.history} 条历史记录</li>
              </ul>
              <p className="mt-2">此操作无法撤销。</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearCache}>确认清空</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showPrivacyDialog} onOpenChange={setShowPrivacyDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>隐私说明</DialogTitle>
            <DialogDescription>我们重视你的隐私和数据安全</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold mb-2">数据存储</h3>
              <ul className="space-y-1 text-gray-600">
                <li>• 最近使用的图片和历史记录仅保存在本机</li>
                <li>• 不会上传到任何服务器（除非进行生成）</li>
                <li>• 你可以随时清空缓存</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">兑换与积分</h3>
              <ul className="space-y-1 text-gray-600">
                <li>• 激活码兑换需要联网核销</li>
                <li>• 积分余额与明细保存在本机</li>
              </ul>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>常见问题</DialogTitle>
            <DialogDescription>快速解答常见疑问</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold mb-2">如何开始？</h3>
              <p className="text-gray-600">在首页进入“模型渲染/图片修复”，上传图片后即可开始渲染。</p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">积分是什么？</h3>
              <p className="text-gray-600">
                积分用于完成生成/渲染操作。规则：按生成耗时计费，1 分钟 1 积分（向上取整），最低 1 积分；取消不会扣费。积分通过“激活码兑换”入账。
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPointsDialog} onOpenChange={setShowPointsDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>积分中心</DialogTitle>
            <DialogDescription>当前余额 {balance} 积分</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">账号</div>
                <Button size="sm" variant="ghost" onClick={() => setShowAuthDialog(true)}>
                  {user ? '切换' : '登录'}
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarFallback className="bg-gray-100">
                    <User className="size-4 text-gray-700" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium">{user ? user.displayName : '本机账号'}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {user ? (user.provider === 'wechat' ? '微信登录' : '手机号登录') : '未登录使用本机账号ID'}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">新手与签到</div>
                {!hasClaimedNewbie ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!user) {
                        toast.info('请先登录后领取新手礼包');
                        setShowAuthDialog(true);
                        return;
                      }
                      const res = pointsService.claimNewbiePack(accountId);
                      if (!res.ok) {
                        toast.info('新手礼包已领取');
                        return;
                      }
                      refreshPoints();
                      toast.success('已领取新手礼包 +5');
                    }}
                  >
                    <Gift className="size-4 mr-1" />
                    领新手礼包
                  </Button>
                ) : (
                  <div className="text-xs text-gray-500">新手礼包已领取</div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const res = pointsService.checkIn(accountId);
                    refreshPoints();
                    if (res.ok) {
                      toast.success('签到成功 +3');
                    } else {
                      toast.info(res.reason === 'limit' ? '签到已达上限' : '今天已签到');
                    }
                  }}
                >
                  <CalendarCheck className="size-4 mr-1" />
                  每日签到
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    refreshPoints();
                    toast.success('已刷新');
                  }}
                >
                  <List className="size-4 mr-1" />
                  刷新
                </Button>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="font-medium flex items-center gap-2">
                <CreditCard className="size-4" />
                购买积分
              </div>

              <div className="text-xs text-gray-600">
                选择档位后复制购买信息发给客服，付款后客服返回激活码，你再回到上方“激活码”兑换入账。
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {POINTS_PACKAGES.map((pkg) => (
                  <Card key={pkg.priceText} className="p-3">
                    <div className="space-y-2">
                      <div className="font-semibold">{pkg.priceText} 元</div>
                      <div className="text-xs text-gray-500">{pkg.points} 积分</div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs px-1 h-8"
                        onClick={() => handleCopyPurchaseMessage(pkg)}
                      >
                        复制购买信息
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="text-xs text-gray-500">提示：本页面不会直接给你加积分，积分只会在兑换激活码后入账。</div>
            </Card>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium">积分明细</div>
                <Button size="sm" variant="ghost" onClick={() => refreshPoints()}>
                  刷新
                </Button>
              </div>

              <Card className="divide-y">
                {ledger.length === 0 ? (
                  <div className="px-4 py-4 text-gray-600">暂无记录</div>
                ) : (
                  ledger.map((item) => (
                    <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{item.title}</div>
                        <div className="text-xs text-gray-600 mt-0.5">{formatDateTime(item.timestamp)}</div>
                      </div>
                      <div className={item.type === 'earn' ? 'text-green-600 font-medium' : 'text-gray-900 font-medium'}>
                        {item.type === 'earn' ? `+${item.amount}` : `-${item.amount}`}
                      </div>
                    </div>
                  ))
                )}
              </Card>
            </section>

            <Card className="p-4 space-y-1">
              <div className="font-medium">积分规则</div>
              <div className="text-gray-600">按生成耗时计费：1 分钟 1 积分（向上取整），最低 1 积分</div>
              <div className="text-gray-600">取消不会扣费；生成失败不扣费</div>
              <div className="text-gray-600">积分通过激活码兑换入账；激活码为一次性、限时有效</div>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>账号登录</DialogTitle>
            <DialogDescription>可选择微信登录或手机号登录</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <Card className="p-4 space-y-3">
              <div className="font-medium">微信登录</div>
              <Button
                onClick={() => {
                  const nextUser = authService.loginWeChat();
                  setUser(nextUser);
                  toast.success('微信登录成功');
                  setShowAuthDialog(false);
                }}
              >
                微信一键登录
              </Button>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="font-medium">手机号登录</div>
              <div className="flex gap-2 items-center">
                <Input
                  value={phoneValue}
                  onChange={(e) => setPhoneValue(e.target.value)}
                  placeholder="请输入 11 位手机号"
                  inputMode="numeric"
                />
                <Button
                  onClick={() => {
                    const nextUser = authService.loginPhone(phoneValue);
                    if (!nextUser) {
                      toast.error('手机号格式不正确');
                      return;
                    }
                    setUser(nextUser);
                    toast.success('登录成功');
                    setShowAuthDialog(false);
                  }}
                >
                  登录
                </Button>
              </div>
              <div className="text-xs text-gray-600 flex items-center gap-2">
                <Smartphone className="size-4" />
                仅用于本机模拟登录，不会发短信
              </div>
            </Card>

            {user && (
              <Card className="p-4 space-y-3">
                <div className="font-medium">当前账号</div>
                <div className="flex items-center justify-between">
                  <div className="text-gray-700">{user.displayName}</div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      authService.logout();
                      setUser(null);
                      toast.success('已退出登录');
                      setShowAuthDialog(false);
                    }}
                  >
                    <LogOut className="size-4 mr-1" />
                    退出
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
