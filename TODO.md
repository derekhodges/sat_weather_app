# Satellite Weather App - Pre-Release TODO

This document outlines all remaining tasks to get the app ready for release. Items are organized by priority and category.

---

## 🔴 CRITICAL - Must Do Before Release

### 1. Performance Fixes (Stability)
**Time Estimate: 6-8 hours**

See `CRITICAL_FIXES.md` for detailed code implementations.

- [ ] **Fix animation interval memory leak** - `MainScreen.js:322`
  - Issue: Timer accumulates when animation speed changes
  - Fix: Remove `settings.animationSpeed` from dependency array

- [ ] **Fix AutoRefresh async memory leak** - `MainScreen.js:350`
  - Issue: Missing AbortController, unmounted component updates
  - Fix: Add AbortController and reduce dependency array

- [ ] **Add drawing path limits** - `DrawingOverlay.js`, `AppContext.js`
  - Issue: Unlimited drawings can cause OOM crashes
  - Fix: Max 100 drawings, 10k points per drawing

- [ ] **Add GeoData cache hard limit** - `geoDataService.js`
  - Issue: Cache can grow unbounded (3MB+)
  - Fix: Enforce MAX_CACHE_SIZE = 30, TTL = 15 minutes

### 2. RevenueCat Setup (In-App Purchases)
**Time Estimate: 2-3 hours**

The code infrastructure is complete in `src/services/purchases.js`. You need to:

1. [ ] **Create RevenueCat Account**
   - Go to https://www.revenuecat.com
   - Sign up for free tier (handles up to $2,500 MTR)
   - Create a new project

2. [ ] **Set Up iOS App (App Store Connect)**
   - Create app in App Store Connect
   - Set up subscription products:
     - `sat_weather_pro_monthly` - $0.99/month
     - `sat_weather_pro_yearly` - $9.99/year (save 17%)
     - `sat_weather_pro_plus_monthly` - $2.99/month
     - `sat_weather_pro_plus_yearly` - $29.99/year
   - Configure subscription groups and terms

3. [ ] **Set Up Android App (Google Play Console)**
   - Create app in Google Play Console
   - Create same subscription products with matching IDs
   - Set up subscription pricing

4. [ ] **Configure RevenueCat Dashboard**
   - Add iOS app with App Store Connect API key
   - Add Android app with Google Play credentials
   - Create entitlements:
     - `pro` - Grants PRO tier access
     - `pro_plus` - Grants PRO PLUS tier access
   - Link products to entitlements
   - Get API keys

5. [ ] **Add API Keys to Environment**
   ```bash
   # In your .env file (or EAS secrets)
   EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_your_key_here
   EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_your_key_here
   ```

6. [ ] **Test Sandbox Purchases**
   - iOS: Use sandbox tester account
   - Android: Use test track / license testing

### 3. AdMob Integration (Real Ads)
**Time Estimate: 2-3 hours**

The placeholder is ready in `src/components/AdBanner.js`. To integrate real ads:

1. [ ] **Create AdMob Account**
   - Go to https://admob.google.com
   - Create apps for iOS and Android
   - Create banner ad units

2. [ ] **Install AdMob SDK**
   ```bash
   npx expo install expo-ads-admob
   ```

3. [ ] **Update AdBanner.js**
   ```javascript
   import { AdMobBanner } from 'expo-ads-admob';

   // Replace placeholder with:
   <AdMobBanner
     bannerSize="smartBannerPortrait"
     adUnitID={Platform.OS === 'ios'
       ? 'ca-app-pub-xxxxx/yyyyy'
       : 'ca-app-pub-xxxxx/zzzzz'}
     servePersonalizedAds={false}
   />
   ```

4. [ ] **Configure in app.json**
   ```json
   {
     "expo": {
       "ios": {
         "config": {
           "googleMobileAdsAppId": "ca-app-pub-xxxxx~yyyyy"
         }
       },
       "android": {
         "config": {
           "googleMobileAdsAppId": "ca-app-pub-xxxxx~zzzzz"
         }
       }
     }
   }
   ```

5. [ ] **Test with Test Ad Units**
   - Use Google's test ad unit IDs during development
   - Switch to production IDs only for release

---

## 🟡 IMPORTANT - Should Do Before Release

### 4. App Store Compliance

1. [ ] **Privacy Policy**
   - Required for both app stores
   - Must cover: location data, analytics, ads
   - Host on a public URL (GitHub Pages works)

2. [ ] **Terms of Service**
   - Subscription terms and cancellation policy
   - Data usage terms

3. [ ] **App Store Screenshots**
   - iOS: 6.5" and 5.5" screenshots (required)
   - Android: Phone and tablet screenshots
   - Show key features: satellite imagery, overlays, animation

4. [ ] **App Description**
   - Write compelling store listing
   - Highlight key features by tier
   - Include keywords for discoverability

5. [ ] **Age Rating**
   - Complete age rating questionnaire
   - Likely 4+ (no objectionable content)

### 5. Production Environment Setup

1. [ ] **Set Production Feature Flags**
   ```bash
   # .env.production
   EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS=true
   EXPO_PUBLIC_MOCK_PREMIUM=false
   EXPO_PUBLIC_ENABLE_AUTH=false  # or true if you want login
   EXPO_PUBLIC_APP_ENV=production
   ```

2. [ ] **Remove Developer Tools**
   - In `SettingsModal.js` line 48, set:
   ```javascript
   const SHOW_DEV_TOOLS = false; // Change to false for production
   ```

3. [ ] **Google Maps API Key**
   - Replace placeholder in `app.json`:
   ```json
   "config": {
     "googleMaps": {
       "apiKey": "YOUR_ACTUAL_API_KEY"
     }
   }
   ```

4. [ ] **Bundle Identifier / Package Name**
   - Verify `com.satweather.app` is available
   - Or change to your own identifier

### 6. Build Configuration

1. [ ] **EAS Build Setup**
   ```bash
   npm install -g eas-cli
   eas login
   eas build:configure
   ```

2. [ ] **Configure eas.json** for production builds
   ```json
   {
     "build": {
       "production": {
         "env": {
           "EXPO_PUBLIC_APP_ENV": "production"
         }
       }
     }
   }
   ```

3. [ ] **Test Production Build**
   ```bash
   eas build --platform all --profile production
   ```

---

## 🟢 RECOMMENDED - Nice to Have

### 7. Performance Optimizations
**Time Estimate: 8-12 hours**

See `PERFORMANCE_AUDIT.md` for full details.

- [ ] **Split AppContext** into focused contexts
  - AnimationContext (frames, timestamps, playing state)
  - SettingsContext (user preferences)
  - SelectionContext (domain, product, channel)
  - UIContext (menus, modals, orientation)
  - **Impact**: 95% reduction in unnecessary re-renders

- [ ] **Add React.memo** to list components
  - MenuSelector items
  - Overlay toggles
  - Favorites list items

- [ ] **Optimize gesture handlers**
  - Memoize with useCallback
  - Prevent recreation on every render

- [ ] **Implement lazy loading**
  - Only load overlays when activated
  - Defer loading of non-critical components

### 8. User Experience Improvements

- [ ] **Onboarding Tutorial**
  - First-launch walkthrough
  - Explain key features
  - Show tier benefits

- [ ] **Error Handling**
  - Add error boundaries around main components
  - Better network error messages
  - Offline mode indicators

- [ ] **Analytics Integration**
  - Track feature usage
  - Monitor subscription funnel
  - Identify popular products/domains

### 9. Code Quality

- [ ] **Remove Excessive Logging**
  - Console.log statements throughout code
  - Keep only error logging for production
  - Or use proper logging service

- [ ] **TypeScript Migration** (future)
  - Add type safety
  - Better IDE support
  - Catch errors at compile time

---

## 📋 Quick Reference - File Locations

| Feature | File | Notes |
|---------|------|-------|
| **Screen Wake Lock** | `App.js:6,41` | ✅ Implemented |
| **Ad Banner** | `src/components/AdBanner.js` | Placeholder ready |
| **Subscription Screen** | `src/screens/SubscriptionScreen.js` | ✅ Full UI ready |
| **RevenueCat Service** | `src/services/purchases.js` | ✅ API ready |
| **Tier Configuration** | `src/config/subscription.js` | ✅ All tiers defined |
| **Feature Gating** | `src/context/AuthContext.js` | ✅ All checks in place |
| **App Icon** | `SatWeatherApp/assets/icon.png` | ✅ New logo |
| **Splash Screen** | `SatWeatherApp/assets/splash-icon.png` | ✅ New logo |
| **Performance Audit** | `PERFORMANCE_AUDIT.md` | Full analysis |
| **Critical Fixes** | `CRITICAL_FIXES.md` | Code implementations |

---

## 📊 Effort Estimates Summary

| Category | Tasks | Hours | Priority |
|----------|-------|-------|----------|
| Performance Fixes | 4 | 6-8 | 🔴 Critical |
| RevenueCat Setup | 6 | 2-3 | 🔴 Critical |
| AdMob Integration | 5 | 2-3 | 🔴 Critical |
| App Store Compliance | 5 | 4-6 | 🟡 Important |
| Production Setup | 4 | 2-3 | 🟡 Important |
| Build Configuration | 3 | 2-3 | 🟡 Important |
| Advanced Optimizations | 4 | 8-12 | 🟢 Optional |
| UX Improvements | 3 | 6-10 | 🟢 Optional |
| **Total Critical** | **15** | **10-14** | |
| **Total Important** | **12** | **8-12** | |
| **Total Optional** | **7** | **14-22** | |

---

## 🚀 Suggested Release Timeline

### Week 1: Critical Fixes
- Fix all 4 performance/memory issues
- Set up RevenueCat account and products
- Configure AdMob account and ad units

### Week 2: Integration & Testing
- Test sandbox purchases end-to-end
- Test ad display and revenue tracking
- Set up production environment

### Week 3: App Store Prep
- Write app descriptions and metadata
- Create screenshots
- Submit for review

### Week 4: Launch
- Monitor initial downloads
- Track subscription conversions
- Address any user-reported issues

---

## 🔗 Useful Resources

- **RevenueCat Docs**: https://docs.revenuecat.com
- **Expo AdMob**: https://docs.expo.dev/versions/latest/sdk/admob/
- **App Store Guidelines**: https://developer.apple.com/app-store/guidelines/
- **Play Store Guidelines**: https://support.google.com/googleplay/android-developer/answer/9859455
- **EAS Build**: https://docs.expo.dev/build/introduction/

---

*Last updated: 2024-11-17*
*Current app version: 1.0.0*
