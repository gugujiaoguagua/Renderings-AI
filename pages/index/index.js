const STORAGE_KEY = 'ui_preview_url';

Page({
  data: {
    // 提示：真机上 127.0.0.1 指向“手机自己”，需要改成电脑的局域网 IP
    // 例如：http://192.168.1.10:5173
    url: 'http://localhost:5173',
    urlInput: 'http://localhost:5173',
  },

  onLoad(query) {
    // 1) 支持通过页面参数传入：?url=https%3A%2F%2Fexample.com
    const queryUrl = typeof query?.url === 'string' ? decodeURIComponent(query.url) : '';

    // 2) 其次读取本地存储
    let storedUrl = '';
    try {
      storedUrl = wx.getStorageSync(STORAGE_KEY) || '';
    } catch (e) {
      storedUrl = '';
    }

    const nextUrl = queryUrl || storedUrl || this.data.url;
    this.setData({ url: nextUrl, urlInput: nextUrl });
    console.log('Preview URL:', nextUrl);
  },

  onUrlInput(e) {
    const value = e?.detail?.value ?? '';
    this.setData({ urlInput: value });
  },

  onLoadUrl() {
    const nextUrl = (this.data.urlInput || '').trim();
    if (!nextUrl) return;

    this.setData({ url: nextUrl });
    try {
      wx.setStorageSync(STORAGE_KEY, nextUrl);
    } catch (e) {
      // ignore
    }
  },

  onPasteAndLoad() {
    wx.getClipboardData({
      success: (res) => {
        const text = (res?.data || '').trim();
        if (!text) return;
        this.setData({ urlInput: text, url: text });
        try {
          wx.setStorageSync(STORAGE_KEY, text);
        } catch (e) {
          // ignore
        }
      },
    });
  },
})

