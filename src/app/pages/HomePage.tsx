import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImagePlus, Camera, History, User, AlertCircle, Box, Sparkles } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Avatar, AvatarFallback } from '@/app/components/ui/avatar';
import { exampleCategories } from '@/app/services/examples';
import { storageService } from '@/app/services/storage';
import type { ImageData } from '@/app/types';
import { toast } from 'sonner';

export function HomePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recentImages, setRecentImages] = useState<ImageData[]>([]);
  const [hasPermission, setHasPermission] = useState(true);

  useEffect(() => {
    setRecentImages(storageService.getRecentImages());
  }, []);

  const handleImageSelect = (image: ImageData) => {
    storageService.addRecentImage(image);
    navigate('/confirm', { state: { image } });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('图片大小不能超过 10MB');
      return;
    }

    // Create object URL for preview
    const url = URL.createObjectURL(file);
    const image: ImageData = {
      id: `upload-${Date.now()}`,
      url,
      source: 'album',
      timestamp: Date.now()
    };

    handleImageSelect(image);
  };

  const handleAlbumClick = () => {
    fileInputRef.current?.click();
  };

  const handleModelRenderClick = () => {
    navigate('/model-render');
  };

  const handleCameraClick = () => {
    // In a real app, this would open the camera
    toast.info('相机功能需要在移动设备上使用');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">选一张图开始生成</h1>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/history')}
            >
              <History className="size-4 mr-1" />
              历史
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/settings')}
            >
              <Avatar className="size-8">
                <AvatarFallback className="bg-gray-100">
                  <User className="size-4 text-gray-700" />
                </AvatarFallback>
              </Avatar>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Permission Alert */}
        {!hasPermission && (
          <Alert>
            <AlertCircle className="size-4" />
            <AlertDescription>
              需要相册访问权限才能选择图片。
              <Button variant="link" className="h-auto p-0 ml-2">
                去开启权限
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Main Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card
            className="p-8 hover:shadow-lg transition-shadow cursor-pointer border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white"
            onClick={handleAlbumClick}
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="size-16 rounded-full bg-blue-500 flex items-center justify-center">
                <ImagePlus className="size-8 text-white" />
              </div>
              <div>
                <h2 className="font-semibold mb-1">从相册选择</h2>
                <p className="text-sm text-gray-600">选择一张照片开始创作</p>
              </div>
            </div>
          </Card>

          <Card
            className="p-8 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={handleCameraClick}
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="size-16 rounded-full bg-gray-200 flex items-center justify-center">
                <Camera className="size-8 text-gray-600" />
              </div>
              <div>
                <h2 className="font-semibold mb-1">拍照</h2>
                <p className="text-sm text-gray-600">拍摄新照片进行创作</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card
            className="p-8 hover:shadow-lg transition-shadow cursor-pointer border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white"
            onClick={handleModelRenderClick}
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="size-16 rounded-full bg-purple-500 flex items-center justify-center">
                <Box className="size-8 text-white" />
              </div>
              <div>
                <h2 className="font-semibold mb-1">模型渲染</h2>
                <p className="text-sm text-gray-600">选择渲染模型进行创作</p>
              </div>
            </div>
          </Card>

          <Card
            className="p-8 hover:shadow-lg transition-shadow cursor-pointer border-2 border-green-200 bg-gradient-to-br from-green-50 to-white"
            onClick={() => {}}
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="size-16 rounded-full bg-green-500 flex items-center justify-center">
                <Sparkles className="size-8 text-white" />
              </div>
              <div>
                <h2 className="font-semibold mb-1">智能创造</h2>
                <p className="text-sm text-gray-600">AI驱动创意生成</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Example Images */}
        <section>
          <h2 className="text-lg font-semibold mb-4">示例图片</h2>
          <div className="space-y-6">
            {exampleCategories.map((category) => (
              <div key={category.id}>
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  {category.name}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {category.images.map((image) => (
                    <Card
                      key={image.id}
                      className="aspect-square overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                      onClick={() => handleImageSelect(image)}
                    >
                      <img
                        src={image.url}
                        alt={`示例 ${category.name}`}
                        className="w-full h-full object-cover"
                      />
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Images */}
        {recentImages.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">最近使用</h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {recentImages.map((image) => (
                <Card
                  key={image.id}
                  className="aspect-square overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                  onClick={() => handleImageSelect(image)}
                >
                  <img
                    src={image.url}
                    alt="最近使用"
                    className="w-full h-full object-cover"
                  />
                </Card>
              ))}
            </div>
          </section>
        )}


      </main>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
