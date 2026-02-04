interface AnalysisResult {
  summary: string;
  details: string;
  tags: string[];
  confidence: number;
}

interface RequestBody {
  imageDataUrl?: string;
}

const mockAnalyses: AnalysisResult[] = [
  {
    summary: '室内人像、柔光、浅景深',
    details: '这是一张专业的人像摄影作品，采用自然光拍摄，背景虚化效果良好。人物表情自然，光线柔和，整体色调温暖。适合用于头像、社交媒体或专业简历。',
    tags: ['人像', '室内', '自然光', '专业'],
    confidence: 0.92
  },
  {
    summary: '风景摄影、日落时分、山景',
    details: '壮丽的山地风光，拍摄于日落时分。画面层次分明，色彩饱满，展现了大自然的磅礴气势。光线温暖，适合作为壁纸或旅行记录。',
    tags: ['风景', '山景', '日落', '户外'],
    confidence: 0.89
  },
  {
    summary: '宠物摄影、动物特写、自然环境',
    details: '可爱的宠物照片，捕捉到了动物生动的表情和姿态。背景简洁，主体突出，色彩自然。非常适合宠物主人纪念或分享。',
    tags: ['宠物', '动物', '特写', '户外'],
    confidence: 0.95
  },
  {
    summary: '产品摄影、简约风格、静物',
    details: '专业的产品摄影，采用简约的构图和纯净的背景。光线均匀，细节清晰，能够很好地展现产品的质感和设计。适合电商或品牌展示。',
    tags: ['产品', '静物', '简约', '商业'],
    confidence: 0.88
  },
  {
    summary: '抽象艺术、色彩丰富、创意设计',
    details: '充满创意的抽象作品，色彩鲜明，构图独特。视觉冲击力强，富有艺术感和想象空间。适合作为装饰画或设计素材。',
    tags: ['抽象', '艺术', '色彩', '创意'],
    confidence: 0.86
  }
];

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {})
    },
    ...init
  });
}

export const onRequestPost = async ({ request }: { request: Request }) => {
  const body = (await request.json().catch(() => ({}))) as RequestBody;
  if (!body.imageDataUrl || typeof body.imageDataUrl !== 'string') {
    return json({ error: 'missing-image' }, { status: 400 });
  }

  const idx = Math.floor(Math.random() * mockAnalyses.length);
  return json({ analysis: mockAnalyses[idx] });
};
