const hi = require('../../utils/hi.js');
const ui = require('../../utils/ui.js');

Page({
  data: {
    photo: '', note: '', name: '', authed: false, busy: false,
    ready: false, share: null, recents: [],
  },

  onShow() {
    this.setData({ authed: hi.authed(), recents: ui.getRecents() });
    if (hi.authed()) {
      hi.refreshMe().then(() => {
        const me = hi.ME();
        const server = (me && me.profile && me.profile.display_name) || '';
        // don't clobber a name the user is mid-typing; only fill when empty
        if (server && !(this.data.name || '').trim()) this.setData({ name: server });
      }).catch(() => {});
    }
  },

  chooseCamera() { this.choose('camera'); },
  chooseAlbum() { this.choose('album'); },
  choose(src) {
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sourceType: [src], sizeType: ['compressed'],
      success: (r) => {
        const f = r.tempFiles && r.tempFiles[0];
        if (f) this.setData({ photo: f.tempFilePath, note: '', ready: false, share: null });
      },
      fail: () => {},
    });
  },
  clearPhoto() { this.setData({ photo: '', ready: false, share: null }); },
  // editing after the card was generated invalidates it — force a re-generate
  onNote(e) { this.setData({ note: e.detail.value, ready: false, share: null }); },
  onName(e) { this.setData({ name: e.detail.value, ready: false, share: null }); },

  // WeChat login (from a <button open-type="getPhoneNumber">)
  async onGetPhone(e) {
    const d = e.detail || {};
    if (d.errMsg && d.errMsg.indexOf('ok') < 0) { return; } // user declined
    this.setData({ busy: true });
    wx.showLoading({ title: '登录中', mask: true });
    try {
      await hi.wechatLogin(d);
      await hi.refreshMe();
      const me = hi.ME();
      this.setData({ authed: true, name: (me && me.profile && me.profile.display_name) || this.data.name });
      wx.hideLoading();
      ui.toast('已用微信登录 ✓');
    } catch (err) {
      wx.hideLoading(); ui.toast(ui.errText(err));
    } finally { this.setData({ busy: false }); }
  },

  async prepareShare() {
    if (!hi.authed()) { ui.toast('请先微信登录'); return; }
    const name = (this.data.name || '').trim();
    if (!name) { ui.toast('先填一下你的名字'); return; }
    if (!this.data.photo) { ui.toast('先拍一张照片'); return; }
    this.setData({ busy: true });
    wx.showLoading({ title: '生成中', mask: true });
    try {
      await hi.ensureProfile(name);
      const up = await hi.uploadPhoto(this.data.photo, this.data.note);
      // persist BEFORE building the share card: FileSystemManager.saveFile MOVES the temp file,
      // so a share.imageUrl still pointing at the temp path would be dead by share time.
      const saved = await ui.persistPhoto(this.data.photo);
      const me = hi.ME(); const pid = me && me.public_id; const s = hi.getSession();
      const q = ['from=' + encodeURIComponent(name)];
      if (pid) q.push('p=' + pid);
      if (s && s.agent_id) q.push('a=' + s.agent_id);
      if (pid && up.isPublic) q.push('img=' + up.id);
      if (this.data.note) q.push('note=' + encodeURIComponent(this.data.note.slice(0, 80)));
      if (me && me.profile && me.profile.headline) q.push('hl=' + encodeURIComponent(me.profile.headline));
      const path = '/pages/connect/index?' + q.join('&');
      const share = { title: name + ' 想在 Hi 上和你连接 👋', path, imageUrl: saved };

      ui.addRecent({ id: Date.now(), photo: saved, note: this.data.note, imageId: up.id, isPublic: up.isPublic, ts: Date.now() });

      this.setData({ photo: saved, ready: true, share, recents: ui.getRecents() });
      wx.hideLoading();
      if (!up.isPublic) ui.toast('照片审核中，仍会随卡片一起发送');
    } catch (err) {
      wx.hideLoading(); ui.toast(ui.errText(err));
    } finally { this.setData({ busy: false }); }
  },

  onShareAppMessage() {
    return this.data.share || { title: 'whoimet — 拍张照，一条链接就把你俩连上', path: '/pages/capture/index' };
  },
});
