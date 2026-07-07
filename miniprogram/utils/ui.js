// whoimet — small UI + local-store helpers
function toast(t) { wx.showToast({ title: t, icon: 'none', duration: 2200 }); }

const ERR = {
  not_signed_in: '请先微信登录', token_expired: '登录已过期，请重新登录',
  phone_declined: '需要授权手机号才能登录', wx_login_failed: '微信登录失败',
  wechat_login_failed: '微信登录失败', network_error: '网络不太好，重试一下',
  no_presign_url: '上传初始化失败', read_file_failed: '读取照片失败',
  insufficient_credits: '对方的连接额度暂时用完了', profile_required: '正在创建你的资料…',
  connect_failed: '连接失败，重试一下', wechat_not_configured: '微信登录还没配置好（缺 AppID/AppSecret）',
};
function errText(e) {
  const c = (e && (e.code || e.message)) || 'error';
  if (ERR[c]) return ERR[c];
  if (typeof c === 'string' && c.indexOf('s3_put_') === 0) return '照片上传失败，重试一下';
  return typeof c === 'string' ? c.replace(/_/g, ' ') : '出错了';
}

const RK = 'wim_recents';
function getRecents() { try { return wx.getStorageSync(RK) || []; } catch (e) { return []; } }
function addRecent(r) { const a = getRecents(); a.unshift(r); wx.setStorageSync(RK, a.slice(0, 20)); }

// persist a temp photo so it survives past this session (for the Recent thumbnails)
function persistPhoto(tempPath) {
  return new Promise((resolve) => {
    try {
      wx.getFileSystemManager().saveFile({
        tempFilePath: tempPath,
        success: (r) => resolve(r.savedFilePath),
        fail: () => resolve(tempPath),
      });
    } catch (e) { resolve(tempPath); }
  });
}

module.exports = { toast, errText, getRecents, addRecent, persistPhoto };
