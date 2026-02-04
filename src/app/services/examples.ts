import type { ImageData } from '@/app/types';

export const exampleImages: ImageData[] = [
  {
    id: 'example-portrait-1',
    url: 'https://images.unsplash.com/photo-1665021758862-8d6f857c40fa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMHdvbWFuJTIwbmF0dXJhbCUyMGxpZ2h0fGVufDF8fHx8MTc3MDA1OTA2OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    source: 'example',
    timestamp: Date.now()
  },
  {
    id: 'example-landscape-1',
    url: 'https://images.unsplash.com/photo-1465056836041-7f43ac27dcb5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsYW5kc2NhcGUlMjBtb3VudGFpbiUyMHN1bnNldHxlbnwxfHx8fDE3NzAwNDkxNDh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    source: 'example',
    timestamp: Date.now()
  },
  {
    id: 'example-pet-1',
    url: 'https://images.unsplash.com/photo-1719292606971-0916fc62f5b0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBoYXBweXxlbnwxfHx8fDE3NzAxMDA4NTV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    source: 'example',
    timestamp: Date.now()
  },
  {
    id: 'example-product-1',
    url: 'https://images.unsplash.com/photo-1610219171722-87b3f4170557?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9kdWN0JTIwY29mZmVlJTIwbWluaW1hbHxlbnwxfHx8fDE3NzAxMDA4NTV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    source: 'example',
    timestamp: Date.now()
  },
  {
    id: 'example-illustration-1',
    url: 'https://images.unsplash.com/photo-1736175549681-c24c552da1e2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGNvbG9yZnVsJTIwaWxsdXN0cmF0aW9ufGVufDF8fHx8MTc3MDAyMzI0MHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    source: 'example',
    timestamp: Date.now()
  },
  {
    id: 'example-portrait-2',
    url: 'https://images.unsplash.com/photo-1672685667592-0392f458f46f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMG1hbiUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3Njk5OTQwNTR8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    source: 'example',
    timestamp: Date.now()
  }
];

export const exampleCategories = [
  {
    name: '头像',
    id: 'portrait',
    images: exampleImages.filter(img => img.id.includes('portrait'))
  },
  {
    name: '风景',
    id: 'landscape',
    images: exampleImages.filter(img => img.id.includes('landscape'))
  },
  {
    name: '宠物',
    id: 'pet',
    images: exampleImages.filter(img => img.id.includes('pet'))
  }
];
