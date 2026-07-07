// whoimet — Hi REST client for WeChat Mini Program.
// No MCP, no OAuth browser flow: WeChat login (server-verified phone) -> Hi bearer,
// then direct HTTPS to hi.hirey.ai capability endpoints.
//
// IMPORTANT: add these to the Mini Program admin console -> 开发 -> 开发设置 -> request 合法域名:
//   https://hi.hirey.ai
//   https://hirey-hi-prod-owner-documents.s3.us-east-2.amazonaws.com   (photo upload target)

const HI_BASE = 'https://hi.hirey.ai';
const SS_KEY = 'wim_hi';

function err(code, extra) { const e = new Error(code); e.code = code; if (extra) Object.assign(e, extra); return e; }

/* ---------------- session ---------------- */
function getSession() { try { return wx.getStorageSync(SS_KEY) || null; } catch (e) { return null; } }
function setSession(s) { wx.setStorageSync(SS_KEY, s); }
function clearSession() { try { wx.removeStorageSync(SS_KEY); } catch (e) {} }
function authed() { const s = getSession(); return !!(s && s.access_token && (!s.expires_at || Date.now() < s.expires_at - 60000)); }

/* ---------------- promisified wx ---------------- */
function request(opt) {
  return new Promise((resolve, reject) => {
    wx.request(Object.assign({}, opt, { success: resolve, fail: (e) => reject(err('network_error', { detail: e })) }));
  });
}
function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({ success: resolve, fail: (e) => reject(err('wx_login_failed', { detail: e })) });
  });
}

/* ---------------- auth ---------------- */
// phoneDetail is the `e.detail` from a <button open-type="getPhoneNumber"> bindgetphonenumber.
// New-flow only (base lib >= 2.21.2 yields e.detail.code, exchanged server-side via the app
// access_token — session_key-independent, so calling wx.login afterwards is safe). The legacy
// encryptedData lane is deliberately unsupported: it breaks when wx.login rotates the session_key.
async function wechatLogin(phoneDetail) {
  if (!phoneDetail || (!phoneDetail.code && !phoneDetail.encryptedData)) throw err('phone_declined');
  if (!phoneDetail.code) throw err('wechat_lib_too_old');
  const lr = await wxLogin();
  if (!lr || !lr.code) throw err('wx_login_failed');
  const body = { login_code: lr.code, phone_code: phoneDetail.code };
  const r = await request({
    url: HI_BASE + '/v1/auth/wechat/miniprogram/login', method: 'POST',
    header: { 'content-type': 'application/json' }, data: body,
  });
  const j = r.data || {};
  if (r.statusCode >= 400 || !j.access_token) throw err(j.error || j.message || ('http_' + r.statusCode));
  setSession({
    access_token: j.access_token,
    expires_at: Date.now() + (Number(j.expires_in || 2592000) * 1000),
    agent_id: j.agent_id, workspace_id: j.workspace_id,
  });
  return j;
}

/* ---------------- capability calls ---------------- */
async function callWith(capability, payload, bearer) {
  const header = { 'content-type': 'application/json' };
  if (bearer) header.authorization = 'Bearer ' + bearer;
  const r = await request({
    url: HI_BASE + '/v1/capabilities/' + capability + '/call', method: 'POST',
    header, data: payload,
  });
  const j = r.data || {};
  const expired = bearer && (r.statusCode === 401 || j.error === 'token_expired' || (j.data && j.data.error_code === 'token_expired'));
  if (expired) { clearSession(); throw err('token_expired'); }
  if (r.statusCode >= 400) throw err(j.error || j.message || ('http_' + r.statusCode), { data: j });
  if (j && j.error) throw err(j.error, { data: j });
  return j && j.result !== undefined ? j.result : j;
}
async function call(capability, payload) {
  const s = getSession();
  if (!s || !s.access_token) throw err('not_signed_in');
  return callWith(capability, payload, s.access_token);
}
// anonymous-allowed reads (browse_feed etc.) — send the bearer if we have one, none otherwise
async function callAnon(capability, payload) {
  const s = getSession();
  return callWith(capability, payload, (s && s.access_token) || null);
}

/* public owner card (anonymous) — used by the connect page to hydrate the sender */
async function ownerJson(publicId) {
  try {
    const r = await request({ url: HI_BASE + '/owner/' + publicId + '.json', method: 'GET', header: { accept: 'application/json' } });
    if (r.statusCode === 200) return r.data;
  } catch (e) {}
  return null;
}
function ownerImageUrl(publicId, imageId) { return HI_BASE + '/owner/' + publicId + '/image/' + imageId; }

/* ---------------- profile ---------------- */
let ME = null;
function parsePid(url) { const m = String(url || '').match(/\/owner\/(\d+)/); return m ? m[1] : null; }
async function refreshMe() {
  const g = await call('hi.owners', { action: 'get' });
  const prof = g.owner_profile || g.profile || g || {};
  ME = { profile: prof, owner_public_url: g.owner_public_url || prof.owner_public_url, public_id: g.public_id || parsePid(g.owner_public_url || prof.owner_public_url) };
  getApp().globalData.me = ME;
  return ME;
}
async function ensureProfile(name) {
  const patch = { visibility_status: 'public' };
  if (name) patch.display_name = name;
  await call('hi.owners', { action: 'update_profile', ...patch });
  await refreshMe();
}

/* ---------------- photo upload (presign -> raw S3 PUT -> finalize) ---------------- */
function readFileBytes(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({ filePath, success: (r) => resolve(r.data), fail: (e) => reject(err('read_file_failed', { detail: e })) });
  });
}
// Compresses via wx.compressImage upstream (in the page); here we just upload the given temp file.
async function uploadPhoto(tempFilePath, note) {
  const bytes = await readFileBytes(tempFilePath); // ArrayBuffer
  const size = bytes.byteLength;
  if (size > 25 * 1024 * 1024) throw err('photo_too_large'); // server cap (OWNER_IMAGE_MAX_UPLOAD_BYTES)
  const pre = await call('hi.owner-images', {
    action: 'presign_upload', kind: 'post', original_filename: 'whoimet.jpg', mime_type: 'image/jpeg',
    size_bytes: size, title: 'Met via whoimet', caption_markdown: (note || '').slice(0, 300),
    request_public_on_approve: true, feed_eligible: true,
  });
  const img = pre.image || pre; const up = pre.upload || {};
  const url = up.url || up.upload_url || up.put_url;
  if (!url) throw err('no_presign_url');
  // wx.request with an ArrayBuffer body performs a raw binary PUT (unlike wx.uploadFile, which is
  // multipart). Required S3 headers (content-type, x-amz-server-side-encryption) are passed through.
  const pr = await request({ url, method: 'PUT', header: up.required_headers || {}, data: bytes });
  if (pr.statusCode >= 300) throw err('s3_put_' + pr.statusCode);
  const fin = await call('hi.owner-images', { action: 'finalize_upload', image_id: img.id, reported_size_bytes: size });
  const fimg = fin.image || fin || {};
  const vis = fimg.visibility_status || fimg.visibility;
  const rev = fimg.review_status || fimg.review;
  return { id: img.id, isPublic: vis === 'public' && (rev === 'approved' || rev === undefined) };
}

/* ---------------- connect (used by the connect page) ---------------- */
// cannot_contact_self_agent | cannot_contact_own_owner | same_source_target_agent (request_create)
const isSelfCode = (c) => /self|own_owner|same_source_target/.test(String(c || ''));
const okishCode = (c) => /already|exist|duplicate/.test(String(c || ''));
// Returns 'connected' | 'self' | throws.
async function connectTo(targetPublicId, targetAgentId, myName) {
  const s = getSession();
  if (s && targetAgentId && s.agent_id === targetAgentId) return 'self';
  let ok = false, lastErr = null;
  if (targetPublicId) {
    try { await contactOwner(targetPublicId); ok = true; }
    catch (e) {
      if (isSelfCode(e.code)) return 'self';
      if (e.code === 'profile_required' || e.code === 'owner_profile_required') {
        try { await ensureProfile(myName || '微信用户'); await contactOwner(targetPublicId); ok = true; }
        catch (e2) { if (isSelfCode(e2.code)) return 'self'; if (okishCode(e2.code)) ok = true; else lastErr = e2; }
      } else if (okishCode(e.code)) ok = true; else lastErr = e;
    }
  }
  if (targetAgentId) {
    try {
      await call('hi.social-relationships', { action: 'request_create', target_agent_id: targetAgentId, relation_type: 'friend', intent: { source: 'whoimet', name: myName || undefined } });
      ok = true;
    } catch (e) { if (isSelfCode(e.code)) return 'self'; if (okishCode(e.code)) ok = true; else if (!lastErr) lastErr = e; }
  }
  if (!ok) throw lastErr || err('connect_failed');
  return 'connected';
}
function contactOwner(publicId) {
  return call('hi.pairings', { action: 'contact_owner', target_owner_public_id: publicId, text: '我们刚见过面 👋 — 从 whoimet 的照片连过来的。' });
}

module.exports = {
  HI_BASE, getSession, setSession, clearSession, authed,
  wechatLogin, call, callAnon, ownerJson, ownerImageUrl,
  ME: () => ME, refreshMe, ensureProfile, uploadPhoto, connectTo, contactOwner,
};
