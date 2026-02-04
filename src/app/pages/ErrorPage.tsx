import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import type { GenerationError, ImageData, AnalysisResult } from '@/app/types';

export function ErrorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const error = location.state?.error as GenerationError | undefined;
  const image = location.state?.image as ImageData | undefined;
  const analysis = location.state?.analysis as AnalysisResult | undefined;

  const handleRetry = () => {
    if (image && analysis) {
      navigate('/generating', { state: { image, analysis } });
    } else if (image) {
      navigate('/confirm', { state: { image } });
    } else {
      navigate('/');
    }
  };

  const handleChangeImage = () => {
    navigate('/');
  };

  const getErrorIcon = () => {
    switch (error?.type) {
      case 'network':
        return '📡';
      case 'format':
        return '📄';
      case 'compliance':
        return '⚠️';
      case 'service-busy':
        return '⏳';
      default:
        return '❌';
    }
  };

  const getErrorColor = () => {
    switch (error?.type) {
      case 'compliance':
        return 'text-red-600';
      case 'network':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <Card className="p-8">
          <div className="text-center space-y-6">
            {/* Icon */}
            <div className="text-6xl">{getErrorIcon()}</div>

            {/* Error Message */}
            <div className="space-y-2">
              <h2 className={`text-xl font-semibold ${getErrorColor()}`}>
                {error?.message || '生成失败'}
              </h2>
              <p className="text-gray-600">
                {error?.action || '请重试或换一张图片'}
              </p>
            </div>

            {/* Error Type Badge */}
            {error?.type && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
                <AlertCircle className="size-4" />
                {error.type === 'network' && '网络错误'}
                {error.type === 'format' && '格式错误'}
                {error.type === 'compliance' && '内容不符合规范'}
                {error.type === 'service-busy' && '服务繁忙'}
                {error.type === 'permission' && '权限不足'}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3 pt-4">
              {error?.type !== 'compliance' && (
                <Button
                  onClick={handleRetry}
                  className="w-full"
                >
                  <RefreshCw className="size-4 mr-2" />
                  重试
                </Button>
              )}
              <Button
                onClick={handleChangeImage}
                variant="outline"
                className="w-full"
              >
                <Home className="size-4 mr-2" />
                换一张图
              </Button>
            </div>

            {/* Additional Help */}
            {error?.type === 'compliance' && (
              <div className="text-sm text-gray-600 border-t pt-4 mt-4">
                <p className="mb-2">该图片可能包含：</p>
                <ul className="text-left space-y-1 text-xs">
                  <li>• 不适宜的内容</li>
                  <li>• 受版权保护的作品</li>
                  <li>• 其他不符合社区规范的内容</li>
                </ul>
                <button className="text-blue-600 hover:underline mt-3">
                  了解更多
                </button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
