# whoimet — 微信小程序

拍一张你刚遇到的人的照片，发一条微信卡片。对方打开、**微信一键登录**（自动带上已验证的中国手机号，不用验证码），你俩就在 HiRey 的 **Hi** 平台上建立了真实、双方同意的连接。

原生小程序（WXML/WXSS/JS，零第三方依赖）。H5 网页版在上一级目录 `../`（给非微信场景兜底）。

## 闭环

1. **拍照** — `wx.chooseMedia`（相机/相册），上传到你的 Hi 主页图（`hi.owner-images` presign → 原生 S3 PUT → finalize）。
2. **分享** — `onShareAppMessage` 生成一张微信转发卡片，`path` 带上你的名字、主页 id、agent id、照片 id。
3. **对方打开** — 卡片进入 `pages/connect`，用 `/owner/:id.json` 拉你的实时名片。
4. **微信登录** — `<button open-type="getPhoneNumber">` + `wx.login` → 后端 `/v1/auth/wechat/miniprogram/login` 换 openid + 解密手机号 → 可信绑定 Hi 身份（免 OTP）→ 拿到 Hi bearer。
5. **建立关系** — `hi.pairings.contact_owner`（双方可见的会话）+ `hi.social-relationships.request_create`（好友边，你在小程序里确认）。

## 上线前你需要做的（只有你能做）

1. **注册企业主体小程序并认证**：`getPhoneNumber`（一键手机号）只对**企业主体 + 已认证**的小程序开放，个人主体拿不到手机号。
2. 把 **AppID** 填进 `project.config.json` 的 `appid`，把 **AppID + AppSecret** 配到后端（见 `../../hi-platform` 的 `/v1/auth/wechat/*`，走 `WECHAT_MP_APPID` / `WECHAT_MP_APPSECRET` 环境变量/prod secrets）。
3. 在小程序后台 **开发 → 开发设置 → 服务器域名 → request 合法域名** 里加上：
   - `https://hi.hirey.ai`
   - `https://hirey-hi-prod-owner-documents.s3.us-east-2.amazonaws.com`（照片上传的直传目标）
   > 卡片/名片里的图片用 `<image>` 加载，不受 request 域名限制。
4. 部署后端的 `/v1/auth/wechat/miniprogram/login`（在 hi-platform，随 prod 一起）。

## 目录

```
miniprogram/
  app.json app.js app.wxss sitemap.json project.config.json
  utils/hi.js      # Hi REST 客户端：微信登录、capability 调用、S3 直传
  utils/ui.js      # toast / 错误文案 / 最近列表 / 持久化照片
  pages/capture    # 首页：拍照 + 备注 + 生成分享卡
  pages/connect    # 被分享打开的落地页：名片 + 微信登录 + 连接
  pages/connections# 好友请求（接受）+ 会话列表
  pages/me         # 名片编辑 + 微信登录/退出
```

## 隐私

- 不做人脸识别。对方成为一个节点，只因为**他自己**打开链接并登录。
- 手机号由微信在服务端验证，绝不出现在小程序前端；AppSecret 只在后端。
