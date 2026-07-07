// whoimet Mini Program — global app
App({
  globalData: {
    // Filled by Hi after WeChat login. Also persisted in storage (see utils/hi.js).
    me: null, // { profile, public_id, owner_public_url }
  },
  onLaunch() {
    // nothing to do at launch; auth is lazy (only when the user shares or connects)
  },
});
