// 动态 — the public feed, mirror of hirey.ai/met (anonymous hi.owner-images browse_feed)
const hi = require('../../utils/hi.js');
const ui = require('../../utils/ui.js');

Page({
  data: { items: [], loading: false, done: false, cursor: '', error: '' },

  onShow() { if (!this.data.items.length && !this.data.loading) this.refresh(); },
  onPullDownRefresh() { this.refresh().then(() => wx.stopPullDownRefresh()).catch(() => wx.stopPullDownRefresh()); },
  onReachBottom() { this.loadMore(); },

  refresh() { this.setData({ items: [], cursor: '', done: false, error: '' }); return this.loadMore(); },

  async loadMore() {
    if (this.data.loading || this.data.done) return;
    this.setData({ loading: true, error: '' });
    try {
      const body = { action: 'browse_feed', kind: 'post', limit: 20 };
      if (this.data.cursor) body.cursor = this.data.cursor;
      const r = await hi.callAnon('hi.owner-images', body);
      const raw = (r && (r.images || r.items || r.list)) || [];
      const mapped = raw.map((im) => this.mapItem(im)).filter(Boolean);
      const cursor = (r && (r.next_cursor || r.cursor)) || '';
      this.setData({
        items: this.data.items.concat(mapped),
        cursor,
        done: !cursor || raw.length === 0,
        loading: false,
      });
    } catch (e) {
      this.setData({ loading: false, error: ui.errText(e) });
    }
  },

  mapItem(im) {
    if (!im) return null;
    const owner = im.owner || {};
    const name = owner.display_name || '匿名';
    const dl = im.download;
    const photo = (dl && (dl.url || dl.download_url)) || (typeof dl === 'string' ? dl : '') || '';
    // the web feed's names line is "owner × title" (title carries the met people, e.g. "Jerry × sandy")
    const title = String(im.title || '').trim();
    const names = (title && !/^met via whoimet$/i.test(title)) ? (name + ' × ' + title) : name;
    const cap = String(im.caption_markdown || '').replace(/[#*_>`\[\]]/g, '').trim();
    return {
      id: im.id,
      photo,
      names,
      initial: (String(name).trim()[0] || '友'),
      avatar: owner.avatar_url || '',
      headline: owner.headline || '',
      cap,
      when: ui.relDate(im.created_at || im.uploaded_at || im.updated_at),
    };
  },
});
