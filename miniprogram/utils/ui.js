// whoimet — small UI + local-store helpers
function toast(t) { wx.showToast({ title: t, icon: 'none', duration: 2200 }); }

const ERR = {
  not_signed_in: '请先微信登录', token_expired: '登录已过期，请重新登录',
  phone_declined: '需要授权手机号才能登录', wx_login_failed: '微信登录失败',
  wechat_login_failed: '微信登录失败', network_error: '网络不太好，重试一下',
  no_presign_url: '上传初始化失败', read_file_failed: '读取照片失败',
  insufficient_credits: '你的连接额度暂时用完了', profile_required: '正在创建你的资料…',
  connect_failed: '连接失败，重试一下', wechat_not_configured: '微信登录还没配置好（缺 AppID/AppSecret）',
  wechat_lib_too_old: '微信版本太旧，请升级微信后重试',
  missing_login_code: '微信登录失败，重试一下', missing_phone: '需要授权手机号才能登录',
  invalid_phone: '手机号无法识别，请重试', masked_phone: '手机号无法识别，请重试',
  internal_error: '服务器开小差了，重试一下', photo_too_large: '照片太大（上限 25MB），换一张试试',
};
function errText(e) {
  const c = (e && (e.code || e.message)) || 'error';
  if (ERR[c]) return ERR[c];
  if (typeof c === 'string') {
    if (c.indexOf('s3_put_') === 0) return '照片上传失败，重试一下';
    if (c.indexOf('upload_too_large') === 0) {
      const m = c.match(/max=(\d+)/);
      return '照片太大（上限 ' + (m ? Math.floor(m[1] / 1048576) + 'MB' : '25MB') + '），换一张试试';
    }
    if (c.indexOf('wechat_') === 0) return '微信登录出了点问题，重试一下';
    return c.replace(/_/g, ' ');
  }
  return '出错了';
}

const RK = 'wim_recents';
function getRecents() { try { return wx.getStorageSync(RK) || []; } catch (e) { return []; } }
function addRecent(r) {
  const a = getRecents(); a.unshift(r);
  const keep = a.slice(0, 20);
  // free the saved-file quota (10MB) for evicted entries — best-effort
  a.slice(20).forEach((old) => {
    if (old && old.photo && String(old.photo).indexOf('tmp') < 0) {
      try { wx.getFileSystemManager().removeSavedFile({ filePath: old.photo, fail: () => {} }); } catch (e) {}
    }
  });
  wx.setStorageSync(RK, keep);
}

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
