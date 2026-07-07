const hi = require('../../utils/hi.js');
const ui = require('../../utils/ui.js');

Page({
  data: { authed: false, name: '', nameInitial: '我', headline: '', avatar: '', publicUrl: '', busy: false },

  onShow() { this.setData({ authed: hi.authed() }); if (hi.authed()) this.load(); },

  async load() {
    try {
      const me = await hi.refreshMe(); const p = me.profile || {};
      const name = p.display_name || '';
      this.setData({ name, nameInitial: (name.trim()[0] || '我'), headline: p.headline || '', avatar: p.avatar_url || '', publicUrl: me.owner_public_url || '' });
    } catch (e) {}
  },

  onName(e) { const v = e.detail.value; this.setData({ name: v, nameInitial: (v.trim()[0] || '我') }); },
  onHl(e) { this.setData({ headline: e.detail.value }); },

  onGetPhone(e) {
    const d = e.detail || {};
    if (d.errMsg && d.errMsg.indexOf('ok') < 0) return;
    this.setData({ busy: true }); wx.showLoading({ title: '登录中', mask: true });
    hi.wechatLogin(d)
      .then(() => this.load())
      .then(() => { this.setData({ authed: true }); wx.hideLoading(); ui.toast('已用微信登录 ✓'); })
      .catch((err) => { wx.hideLoading(); ui.toast(ui.errText(err)); })
      .then(() => this.setData({ busy: false }));
  },

  async save() {
    const name = (this.data.name || '').trim();
    if (!name) { ui.toast('填一下你的名字'); return; }
    this.setData({ busy: true }); wx.showLoading({ title: '保存中', mask: true });
    try {
      await hi.call('hi.owners', { action: 'update_profile', display_name: name, headline: (this.data.headline || '').trim(), visibility_status: 'public' });
      await this.load(); wx.hideLoading(); ui.toast('已保存');
    } catch (err) { wx.hideLoading(); ui.toast(ui.errText(err)); }
    finally { this.setData({ busy: false }); }
  },

  copyLink() { if (this.data.publicUrl) { wx.setClipboardData({ data: this.data.publicUrl }); } },
  signOut() { hi.clearSession(); this.setData({ authed: false, name: '', headline: '', avatar: '', publicUrl: '' }); ui.toast('已退出'); },
});
