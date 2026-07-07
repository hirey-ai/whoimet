const hi = require('../../utils/hi.js');
const ui = require('../../utils/ui.js');

Page({
  data: {
    from: '对方', hl: 'On Hi', note: '', photo: '', avatar: '', verified: false,
    pid: '', agent: '', authed: false, busy: false, done: false, isSelf: false,
  },

  onLoad(opts) {
    const dec = (v) => { try { return decodeURIComponent(v || ''); } catch (e) { return v || ''; } };
    const from = dec(opts.from) || '对方';
    const pid = opts.p || ''; const agent = opts.a || ''; const img = opts.img || '';
    const photo = (pid && img) ? hi.ownerImageUrl(pid, img) : '';
    this.setData({
      from, note: dec(opts.note), hl: dec(opts.hl) || 'On Hi',
      pid, agent, photo, authed: hi.authed(),
    });
    wx.setNavigationBarTitle({ title: from + ' 想和你连接' });
    if (pid) this.hydrate(pid);
  },

  async hydrate(pid) {
    const o = await hi.ownerJson(pid);
    if (o) {
      const patch = {};
      if (o.display_name) { patch.from = o.display_name; wx.setNavigationBarTitle({ title: o.display_name + ' 想和你连接' }); }
      if (o.headline) patch.hl = o.headline;
      if (o.avatar_url) patch.avatar = o.avatar_url;
      if (o.verified) patch.verified = true;
      this.setData(patch);
    }
  },

  // WeChat login from a <button open-type="getPhoneNumber">, then connect
  onGetPhone(e) {
    const d = e.detail || {};
    if (d.errMsg && d.errMsg.indexOf('ok') < 0) return; // declined
    this.authThenConnect(d);
  },
  // already-signed-in visitor → one tap
  oneTap() { if (hi.authed()) this.doConnect(); },

  async authThenConnect(detail) {
    this.setData({ busy: true });
    wx.showLoading({ title: '登录中', mask: true });
    try { await hi.wechatLogin(detail); wx.hideLoading(); await this.doConnect(); }
    catch (err) { wx.hideLoading(); this.setData({ busy: false }); ui.toast(ui.errText(err)); }
  },

  async doConnect() {
    if (!this.data.pid && !this.data.agent) { ui.toast('这个链接缺少连接信息'); return; }
    this.setData({ busy: true });
    wx.showLoading({ title: '连接中', mask: true });
    try {
      let myName = '';
      if (hi.authed()) { try { const me = await hi.refreshMe(); myName = (me && me.profile && me.profile.display_name) || ''; } catch (e) {} }
      const r = await hi.connectTo(this.data.pid, this.data.agent, myName);
      wx.hideLoading();
      this.setData({ done: true, isSelf: r === 'self', authed: hi.authed() });
    } catch (err) {
      wx.hideLoading(); this.setData({ busy: false });
      if (err.code === 'token_expired') { hi.clearSession(); this.setData({ authed: false }); ui.toast('登录已过期，请重新登录'); }
      else ui.toast(ui.errText(err));
    }
  },

  goHome() { wx.switchTab({ url: '/pages/capture/index' }); },
  openConnections() { wx.switchTab({ url: '/pages/connections/index' }); },

  onShareAppMessage() {
    const q = ['from=' + encodeURIComponent(this.data.from)];
    if (this.data.pid) q.push('p=' + this.data.pid);
    if (this.data.agent) q.push('a=' + this.data.agent);
    return { title: this.data.from + ' 想在 Hi 上和你连接 👋', path: '/pages/connect/index?' + q.join('&') };
  },
});
