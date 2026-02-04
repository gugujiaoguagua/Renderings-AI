import type { ImageData, GenerationResult } from '@/app/types';

const RECENT_IMAGES_KEY = 'ai-generator-recent-images';
const HISTORY_KEY = 'ai-generator-history';
const MAX_RECENT_IMAGES = 8;
const MAX_HISTORY = 20;

function hasBlobUrl(url: string) {
  return typeof url === 'string' && url.startsWith('blob:');
}

export const storageService = {
  // Recent images
  getRecentImages(): ImageData[] {
    try {
      const data = localStorage.getItem(RECENT_IMAGES_KEY);
      const parsed = data ? (JSON.parse(data) as ImageData[]) : [];
      const filtered = parsed.filter((img) => !hasBlobUrl(img.url));
      if (filtered.length !== parsed.length) {
        localStorage.setItem(RECENT_IMAGES_KEY, JSON.stringify(filtered));
      }
      return filtered;
    } catch {
      return [];
    }
  },

  addRecentImage(image: ImageData): void {
    try {
      if (hasBlobUrl(image.url)) return;
      const recent = this.getRecentImages();
      // Remove duplicates
      const filtered = recent.filter(img => img.id !== image.id);
      // Add to front
      const updated = [image, ...filtered].slice(0, MAX_RECENT_IMAGES);
      localStorage.setItem(RECENT_IMAGES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save recent image:', error);
    }
  },

  clearRecentImages(): void {
    try {
      localStorage.removeItem(RECENT_IMAGES_KEY);
    } catch (error) {
      console.error('Failed to clear recent images:', error);
    }
  },

  // Generation history
  getHistory(): GenerationResult[] {
    try {
      const data = localStorage.getItem(HISTORY_KEY);
      const parsed = data ? (JSON.parse(data) as GenerationResult[]) : [];
      const filtered = parsed.filter((item) => {
        if (hasBlobUrl(item.generatedUrl)) return false;
        if (hasBlobUrl(item.originalImage?.url)) return false;
        return true;
      });
      if (filtered.length !== parsed.length) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
      }
      return filtered;
    } catch {
      return [];
    }
  },

  addToHistory(result: GenerationResult): void {
    try {
      if (hasBlobUrl(result.generatedUrl)) return;
      if (hasBlobUrl(result.originalImage?.url)) return;
      const history = this.getHistory();
      const updated = [result, ...history].slice(0, MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save to history:', error);
    }
  },

  clearHistory(): void {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  },

  clearAllData(): void {
    this.clearRecentImages();
    this.clearHistory();
  }
};
