const hi = require('../../utils/hi.js');
const ui = require('../../utils/ui.js');

Page({
  data: { authed: false, reqs: [], convs: [], loading: false },

  onShow() {
    const a = hi.authed();
    this.setData({ authed: a });
    if (a) this.load(); else this.setData({ reqs: [], convs: [] });
  },

  async load() {
    this.setData({ loading: true });
    try {
      const rl = await hi.call('hi.social-relationships', { action: 'request_list', direction: 'incoming', status: 'pending', limit: 20 });
      this.setData({ reqs: (rl.requests || []).map((r) => ({ id: r.id || r.request_id, name: (r.intent && r.intent.name) || '新的连接' })) });
    } catch (e) { this.setData({ reqs: [] }); }
    try {
      const pl = await hi.call('hi.pairings', { action: 'list', group_by: 'counterparty', list_limit: 40 });
      const convs = (pl.conversations || pl.pairings || []).map((cv, i) => {
        const agentName = cv.counterpart_display_name || cv.display_name || '';
        const nm = (/hirey web/i.test(agentName) ? '' : agentName) || '连接';
        const pid = cv.counterpart_owner_public_id || cv.owner_public_id || '';
        return { key: 'c' + i, nm, initial: (nm.trim()[0] || '友'), last: cv.last_message_preview || cv.last_message || '已连接', pid, avatar: '' };
      });
      this.setData({ convs });
      this.resolveNames(convs);
    } catch (e) { this.setData({ convs: [] }); }
    this.setData({ loading: false });
  },

  // pairings return the agent label ("Hirey Web") not the profile name — resolve the real name.
  async resolveNames(convs) {
    for (let i = 0; i < convs.length; i++) {
      const cv = convs[i];
      if (!cv.pid) continue;
      const o = await hi.ownerJson(cv.pid);
      if (o && o.display_name) {
        this.setData({
          ['convs[' + i + '].nm']: o.display_name,
          ['convs[' + i + '].initial']: (o.display_name.trim()[0] || '友'),
          ['convs[' + i + '].avatar']: o.avatar_url || '',
        });
      }
    }
  },

  async accept(e) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '处理中', mask: true });
    try {
      const resp = await hi.call('hi.social-relationships', { action: 'request_respond', request_id: id, decision: 'accepted' });
      wx.hideLoading();
      // request_respond returns non-error "no-ops" too: gate on the final status
      // (updated:false + accepted = already connected elsewhere — still a success).
      const st = resp && resp.request && resp.request.status;
      if (st === 'accepted') ui.toast('已连接 🎉');
      else if (st === 'expired') ui.toast('这个请求已过期');
      else ui.toast('这个请求已处理过了');
      this.load();
    }
    catch (err) { wx.hideLoading(); ui.toast(ui.errText(err)); }
  },

  goMe() { wx.switchTab({ url: '/pages/me/index' }); },
});
