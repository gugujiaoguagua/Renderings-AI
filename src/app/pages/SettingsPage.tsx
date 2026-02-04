import { useEffect, useMemo, useRef, useState } from 'react';
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
  Database
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Separator } from '@/app/components/ui/separator';
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
import { Input } from '@/app/components/ui/input';
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
    minute: '2-digit'
  });
}

const catAvatarUrl = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <rect width="200" height="200" rx="100" fill="#111827"/>
    <path d="M50 85 L35 55 L70 70 Z" fill="#F9FAFB"/>
    <path d="M150 85 L165 55 L130 70 Z" fill="#F9FAFB"/>
    <circle cx="70" cy="105" r="10" fill="#F9FAFB"/>
    <circle cx="130" cy="105" r="10" fill="#F9FAFB"/>
    <circle cx="70" cy="105" r="4" fill="#111827"/>
    <circle cx="130" cy="105" r="4" fill="#111827"/>
    <path d="M100 112 C92 118 92 125 100 130 C108 125 108 118 100 112 Z" fill="#FCA5A5"/>
    <path d="M100 130 C90 135 82 133 75 126" stroke="#F9FAFB" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M100 130 C110 135 118 133 125 126" stroke="#F9FAFB" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M55 122 L30 115" stroke="#F9FAFB" stroke-width="4" stroke-linecap="round"/>
    <path d="M55 130 L28 132" stroke="#F9FAFB" stroke-width="4" stroke-linecap="round"/>
    <path d="M145 122 L170 115" stroke="#F9FAFB" stroke-width="4" stroke-linecap="round"/>
    <path d="M145 130 L172 132" stroke="#F9FAFB" stroke-width="4" stroke-linecap="round"/>
  </svg>`
)}`;

export function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showPointsDialog, setShowPointsDialog] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [catBurstKey, setCatBurstKey] = useState(0);
  const [phoneValue, setPhoneValue] = useState('');
  const [user, setUser] = useState(authService.getCurrentUser());
  const accountId = useMemo(() => authService.getAccountId(), [user]);
  const [balance, setBalance] = useState(pointsService.getBalance(accountId));
  const [ledger, setLedger] = useState(pointsService.getLedger(accountId, 10));
  const [customRechargeAmount, setCustomRechargeAmount] = useState('1');
  const burstTimerRef = useRef<number | null>(null);

  const refreshPoints = (targetAccountId = accountId) => {
    setBalance(pointsService.getBalance(targetAccountId));
    setLedger(pointsService.getLedger(targetAccountId, 10));
  };

  useEffect(() => {
    refreshPoints();
  }, [accountId]);

  useEffect(() => {
    if (location.state?.openPoints) {
      setShowPointsDialog(true);
    }
  }, [location.state]);

  const handleClearCache = () => {
    storageService.clearAllData();
    setShowClearDialog(false);
    toast.success('缓存已清空');
  };

  const getCacheSize = () => {
    const recentImages = storageService.getRecentImages();
    const history = storageService.getHistory();
    return {
      images: recentImages.length,
      history: history.length
    };
  };

  const cacheSize = getCacheSize();
  const pointsSummary = useMemo(() => `${balance} 积分`, [balance]);
  const hasClaimedNewbie = useMemo(() => pointsService.hasClaimedNewbie(accountId), [accountId, ledger.length]);

  const handleFixedRecharge = (priceYuan: number, points: number) => {
    const pts = Math.max(0, Math.floor(points));
    if (pts <= 0) return;
    pointsService.earnPoints(accountId, pts, `充值 ${priceYuan} 元`);
    refreshPoints();
    toast.success(`充值成功 +${pts}`);
  };

  const calcRecharge = (amountYuan: number) => {
    const amount = Math.max(0, Math.floor(amountYuan));
    const base = amount * 10;
    const bonus = amount === 10 || amount === 50 || amount === 100 ? amount : 0;
    return { amount, base, bonus, total: base + bonus };
  };

  const handleRecharge = (amountYuan: number, allowBonus: boolean) => {
    const amount = Math.max(0, Math.floor(amountYuan));
    if (amount < 1) {
      toast.error('自定义金额最低 1 元');
      return;
    }

    const base = amount * 10;
    const bonus = allowBonus && (amount === 10 || amount === 50 || amount === 100) ? amount : 0;
    const total = base + bonus;
    const title = bonus > 0 ? `充值 ${amount} 元（送 ${bonus}）` : `充值 ${amount} 元`;

    pointsService.earnPoints(accountId, total, title);
    refreshPoints();
    toast.success(`充值成功 +${total}`);
  };

  const triggerCatBurst = () => {
    setCatBurstKey((k) => k + 1);
    if (burstTimerRef.current) {
      window.clearTimeout(burstTimerRef.current);
    }
    burstTimerRef.current = window.setTimeout(() => {
      setCatBurstKey(0);
    }, 950);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="size-4 mr-1" />
            返回
          </Button>
          <h1 className="flex-1 text-center font-semibold">设置与帮助</h1>
          <div className="w-20" /> {/* Spacer */}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
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
                    {user ? (user.provider === 'wechat' ? '微信登录' : '手机号登录') : '登录后可按账号领取新手礼包'}
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
                    <p className="text-xs text-gray-600 mt-0.5">切换到访客模式</p>
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
              onClick={() => setShowPointsDialog(true)}
            >
              <div className="flex items-center gap-3">
                <Coins className="size-5 text-gray-600" />
                <div className="text-left">
                  <p className="font-medium">积分中心</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {pointsSummary}
                  </p>
                </div>
              </div>
              <ChevronRight className="size-5 text-gray-400" />
            </button>
          </Card>
        </section>

        {/* Privacy & Data */}
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
                  <p className="text-xs text-gray-600 mt-0.5">
                    了解数据如何使用和存储
                  </p>
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

        {/* Help & Support */}
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
                  <p className="text-xs text-gray-600 mt-0.5">
                    查看使用帮助和解答
                  </p>
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
                  <p className="text-xs text-gray-600 mt-0.5">
                    告诉我们你的想法
                  </p>
                </div>
              </div>
              <ChevronRight className="size-5 text-gray-400" />
            </button>
          </Card>
        </section>

        {/* About */}
        <section>
          <Card className="p-4 text-center space-y-2">
            <p className="text-sm text-gray-600">AI 图片生成器</p>
            <p className="text-xs text-gray-500">版本 1.0.0</p>
            <Separator className="my-2" />
            <p className="text-xs text-gray-500">
              使用先进的 AI 技术，基于你的图片智能生成新作品
            </p>
          </Card>
        </section>
      </main>

      {/* Clear Cache Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清空所有缓存？</AlertDialogTitle>
            <AlertDialogDescription>
              这将删除：
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>{cacheSize.images} 张最近使用的图片</li>
                <li>{cacheSize.history} 条生成历史记录</li>
              </ul>
              <p className="mt-2">此操作无法撤销。</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearCache}>
              确认清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Privacy Dialog */}
      <Dialog open={showPrivacyDialog} onOpenChange={setShowPrivacyDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>隐私说明</DialogTitle>
            <DialogDescription>
              我们重视你的隐私和数据安全
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold mb-2">数据存储</h3>
              <ul className="space-y-1 text-gray-600">
                <li>• 最近使用的图片和生成历史仅保存在本机</li>
                <li>• 不会上传到任何服务器（除非进行生成）</li>
                <li>• 你可以随时清空缓存</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">生成过程</h3>
              <ul className="space-y-1 text-gray-600">
                <li>• 生成时图片会临时上传到云端处理</li>
                <li>• 处理完成后自动删除，不会永久存储</li>
                <li>• 传输过程使用加密保护</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">数据使用</h3>
              <ul className="space-y-1 text-gray-600">
                <li>• 仅用于 AI 模型理解和生成</li>
                <li>• 不会用于其他任何目的</li>
                <li>• 不会与第三方分享</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">注意事项</h3>
              <ul className="space-y-1 text-gray-600">
                <li>• 请勿上传包含个人隐私信息的图片</li>
                <li>• 请勿上传受版权保护的内容</li>
                <li>• 请遵守社区规范和使用条款</li>
              </ul>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      {/* Help Dialog */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>常见问题</DialogTitle>
            <DialogDescription>
              快速解答常见疑问
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold mb-2">如何开始？</h3>
              <p className="text-gray-600">
                在首页选择一张图片（从相册、拍照或示例图），系统会自动理解图片内容并生成描述，确认后即可开始生成。
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">生成需要多久？</h3>
              <p className="text-gray-600">
                通常需要 10-30 秒。生成过程中可以选择后台等待，也可以随时取消。
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">如果识别不准确？</h3>
              <p className="text-gray-600">
                在确认页面可以点击"不准确？"进行简单纠正，选择正确的内容类型即可。
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">支持哪些图片格式？</h3>
              <p className="text-gray-600">
                支持 JPG、PNG、WebP 等常见格式，图片大小不超过 10MB。
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">生成失败怎么办？</h3>
              <p className="text-gray-600">
                生成失败不会产生任何费用，可以直接重试。如果多次失败，建议检查网络或换一张图片。
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">历史记录保存多久？</h3>
              <p className="text-gray-600">
                历史记录仅保存在本机，最多保存 20 条。可以在设置中清空所有记录。
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">积分是什么？</h3>
              <p className="text-gray-600">
                积分用于完成生成操作。规则：按生成耗时计费，1 分钟 1 积分（向上取整），最低收取 1 积分；取消不会扣费。
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPointsDialog} onOpenChange={setShowPointsDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>积分中心</DialogTitle>
            <DialogDescription>
              当前余额 {balance} 积分
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">账号</div>
                {user ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAuthDialog(true)}
                  >
                    切换
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAuthDialog(true)}
                  >
                    登录
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarFallback className="bg-gray-100">
                    <User className="size-4 text-gray-700" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium">{user ? user.displayName : '访客'}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {user ? (user.provider === 'wechat' ? '微信登录' : '手机号登录') : '未登录仅能使用访客积分'}
                  </div>
                </div>
              </div>
              {!user && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const nextUser = authService.loginWeChat();
                      setUser(nextUser);
                      toast.success('微信登录成功');
                    }}
                  >
                    微信登录
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowAuthDialog(true)}
                  >
                    手机号登录
                  </Button>
                </div>
              )}
            </Card>

            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">新手与签到</div>
                {hasClaimedNewbie ? (
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={triggerCatBurst}
                    >
                      解压一下
                    </Button>
                    {catBurstKey > 0 && (
                      <span
                        key={catBurstKey}
                        className="pointer-events-none absolute left-1/2 -top-2 z-10 animate-cat-pop"
                      >
                        <img
                          src={catAvatarUrl}
                          alt="cat"
                          className="size-10 rounded-full shadow-md"
                        />
                      </span>
                    )}
                  </div>
                ) : (
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
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    pointsService.earnPoints(accountId, 3, '每日签到');
                    refreshPoints();
                    toast.success('签到成功 +3');
                  }}
                >
                  每日签到 +3
                </Button>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="font-medium">充值</div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => handleFixedRecharge(0.98, 10)}>
                  充 0.98 元 得 10
                </Button>
                <Button variant="outline" onClick={() => handleRecharge(10, true)}>
                  充 10 元 得 {calcRecharge(10).total}
                </Button>
                <Button variant="outline" onClick={() => handleRecharge(50, true)}>
                  充 50 元 得 {calcRecharge(50).total}
                </Button>
                <Button variant="outline" onClick={() => handleRecharge(100, true)}>
                  充 100 元 得 {calcRecharge(100).total}
                </Button>
              </div>

              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={customRechargeAmount}
                  onChange={(e) => setCustomRechargeAmount(e.target.value)}
                />
                <Button
                  onClick={() => {
                    const n = Number(customRechargeAmount);
                    if (!Number.isFinite(n)) {
                      toast.error('请输入正确的金额');
                      return;
                    }
                    handleRecharge(n, false);
                  }}
                >
                  自定义充值
                </Button>
              </div>
              <div className="text-xs text-gray-600">
                自定义金额最低 1 元，不参与赠送
              </div>
            </Card>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium">积分明细</div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    pointsService.resetAll();
                    refreshPoints();
                    toast.success('已重置积分数据');
                  }}
                >
                  重置
                </Button>
              </div>
              <Card className="divide-y">
                {ledger.length === 0 ? (
                  <div className="px-4 py-4 text-gray-600">暂无记录</div>
                ) : (
                  ledger.map((item) => (
                    <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{item.title}</div>
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
              <div className="text-gray-600">取消不会扣费；积分与明细仅保存在本机</div>
              <div className="text-gray-600">首档：0.98 元 = 10 积分</div>
              <div className="text-gray-600">自定义充值比例：1 元 = 10 积分</div>
              <div className="text-gray-600">赠送规则：充 10 元送 10，充 50 元送 50，充 100 元送 100</div>
              <div className="text-gray-600">自定义金额最低 1 元，不参与赠送</div>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>账号登录</DialogTitle>
            <DialogDescription>
              可选择微信登录或手机号登录
            </DialogDescription>
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
