# Satellite Weather App - Subscription Architecture Summary

## Overview

The Satellite Weather App implements a **three-tier subscription model** with comprehensive feature gating. The system is modular, allowing features to be enabled/disabled via environment variables for flexibility during development.

---

## 1. SUBSCRIPTION TIERS

### Tier Structure
Three subscription tiers are defined in `/src/config/subscription.js`:

1. **FREE** - No cost, basic features
   - Price: $0
   - Target: Casual users

2. **PRO** - Professional tier
   - Price: $1.99/month or $20/year
   - Target: Regular users needing more features

3. **PRO_PLUS** - Premium tier
   - Price: $4.99/month or $50/year
   - Target: Power users and professionals

### Feature Tiers Breakdown

#### FREE Tier Features
- **Animation**: Max 6 frames, animation enabled
- **Products & Channels**: Limited
  - Only Geocolor RGB product allowed
  - Only Channel 13 (Clean IR) allowed
- **Domains**: Regional domains only (no local domains)
- **Overlays**: Boundary overlays only
  - States, counties, roads, cities, rivers, lat/lon
- **Drawing & Sharing**: Both enabled
- **Quality**: Standard resolution, no caching, no auto-refresh
- **Advanced**: No inspector mode, no custom time selection
- **Experience**: Ads shown (banner at bottom), not ad-free

#### PRO Tier Features
- **Animation**: Max 24 frames
- **Products & Channels**: ALL products and channels available
- **Domains**: Local domains now included
- **Overlays**: 
  - Boundary overlays ✓
  - Lightning overlays ✓ (GLM Flash, GLM Groups)
  - NWS overlays ✓ (Warnings, watches, mesoscale discussions)
  - SPC overlays ✓ (Convective outlook, tornado probabilities)
  - **Radar overlays ✗** (NOT available in Pro)
- **Drawing & Sharing**: Both enabled
- **Quality**: High resolution, offline caching, auto-refresh
- **Advanced**: Inspector mode enabled, custom time selection disabled
- **Experience**: No ads, ad-free

#### PRO_PLUS Tier Features (Everything + Radar)
- **Animation**: Max 36 frames
- **Products & Channels**: ALL
- **Domains**: All including local domains
- **Overlays**: ALL including
  - MRMS Reflectivity (Pro Plus only)
  - Composite Radar (Pro Plus only)
- **Drawing & Sharing**: Both enabled
- **Quality**: High resolution, offline caching, auto-refresh
- **Advanced**: Inspector mode enabled, **custom time selection enabled**
- **Experience**: No ads, ad-free

---

## 2. FEATURE GATING IMPLEMENTATION

### Core Configuration Files

#### `/src/config/subscription.js`
Main subscription configuration with:
- `SUBSCRIPTION_TIERS` - Constants (FREE, PRO, PRO_PLUS)
- `TIER_FEATURES` - Maps each tier to available features
- Helper functions:
  - `getTierFeatures(tier)` - Get all features for a tier
  - `hasFeature(tier, featureName)` - Check if tier has feature
  - `isFeatureEnabled(userTier, featureName)` - Feature enabled + env checks
  - `isProductAllowed(tier, productId)` - Check product access
  - `isChannelAllowed(tier, channelNumber)` - Check channel access
  - `isOverlayAllowed(tier, overlayId)` - Check overlay access
  - `isLocalDomainAllowed(tier)` - Check local domain access
  - `getMaxFrames(tier)` - Get animation frame limit
  - `shouldShowAds(tier)` - Determine ad display

### Feature Gate Component
**File**: `/src/components/FeatureGate.js`

Wrapper component for gating features:
```javascript
<FeatureGate 
  feature="inspectorMode" 
  featureName="Pixel Inspector"
>
  <InspectorTool />
</FeatureGate>
```

Shows upgrade prompt if user lacks access.

### Authentication Context
**File**: `/src/context/AuthContext.js`

Manages user authentication and subscription state:
- User state and session management (via Supabase)
- Subscription tier tracking
- Developer tier override for testing
- Feature access helper methods:
  - `hasFeatureAccess(featureName)`
  - `canAccessProduct(productId)`
  - `canAccessChannel(channelNumber)`
  - `canAccessOverlay(overlayType)`
  - `canAccessLocalDomain()`
  - `getAnimationMaxFrames()`
  - `shouldDisplayAds()`
  - `getCurrentTierFeatures()`

---

## 3. REAL-WORLD FEATURE GATING EXAMPLES

### Channel Selection Gate (MenuSelector.js)
Channels are visually locked if user doesn't have access:
```javascript
const handleChannelSelect = (channel) => {
  if (!canAccessChannel(channel.number)) {
    showUpgradePrompt(`Channel ${channel.number}`);
    return;
  }
  onSelect(channel);
};
```

### Overlay Gate
Each overlay checks tier before enabling:
- Lightning overlays (glm_flash, glm_groups) → PRO+
- NWS overlays (warnings, watches) → PRO+
- SPC overlays (spc_outlook, spc_tornado) → PRO+
- Radar overlays (mrms, composite_radar) → PRO_PLUS only
- Boundary overlays → All tiers

---

## 4. STORAGE & BACKEND

### User Data Storage

#### Supabase PostgreSQL Database
**Backend**: Cloud-hosted PostgreSQL via Supabase

**Table**: `subscriptions`
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id)
);
```

**Row Level Security (RLS)**:
- Users can read their own subscription
- Service role can manage all subscriptions (for webhooks)

#### Local Storage (AsyncStorage)
**Mobile/Expo**: React Native AsyncStorage for:
- User preferences and settings
- Saved favorites
- Home location
- Developer tier override (testing)

#### Environment-based Configuration
Can disable actual subscriptions and mock them for testing.

---

## 5. USER STATE MANAGEMENT

### AppContext (`/src/context/AppContext.js`)
Manages UI and view state (NOT subscription):
- Selected satellite, domain, channel
- View mode (RGB or channel)
- Current image and animation state
- Overlay states and drawing
- User settings (frame count, animation speed, etc.)
- User location and saved home
- Favorites and menu states

**Persisted to AsyncStorage**:
- `favorites` - Saved favorite views
- `settings` - User preferences
- `homeLocation` - Saved home location

**Settings Structure**:
```javascript
{
  animationSpeed: 800,           // ms per frame
  endDwellDuration: 1500,        // pause on last frame
  frameCount: 12,                // frames to load
  frameSkip: 0,                  // frames to skip
  imageDisplayMode: 'contain',   // contain or cover
  autoRefresh: false,            // auto-refresh enabled
  autoRefreshInterval: 5,        // minutes
  showColorScale: true,          // show color scale bar
  defaultDomain: {},             // default domain
  defaultViewMode: 'rgb',        // rgb or channel
  defaultProduct: {},            // default product
  useLocalTime: false,           // false=UTC, true=local
  channelDisplayMode: 'list',    // list or grid
}
```

### AuthContext (`/src/context/AuthContext.js`)
Manages authentication and subscription state:
- User account info
- Session/auth tokens
- **subscriptionTier** - Current user's tier
- **subscriptionStatus** - 'active', 'cancelled', 'expired'
- Developer tier override (for testing)

**Subscription Lifecycle**:
1. User signs in → `loadSubscriptionStatus()` fetches tier from DB
2. Subscription status checked → Reverts to FREE if expired
3. User signs out → Tier reset to FREE
4. Subscription updates via RevenueCat listener

---

## 6. PAYMENT PROCESSING

### Primary: RevenueCat (Mobile)
**File**: `/src/services/purchases.js`

Handles iOS/Android in-app purchases via RevenueCat SDK:
- Platform abstraction (iOS App Store + Android Play Store)
- Product definitions (4 products):
  - `sat_weather_pro_monthly`
  - `sat_weather_pro_yearly`
  - `sat_weather_pro_plus_monthly`
  - `sat_weather_pro_plus_yearly`
- Entitlements:
  - `pro` → PRO tier
  - `pro_plus` → PRO_PLUS tier

**Key Functions**:
- `initializePurchases()` - Initialize RevenueCat SDK
- `setUserId(userId)` - Link user account
- `getOfferings()` - Get available packages
- `purchasePackage(package)` - Process purchase
- `restorePurchases()` - Restore previous purchases
- `getCurrentTierFromPurchases()` - Get tier from entitlements
- `hasEntitlement(entitlementId)` - Check active entitlement
- Mock offerings for testing without RevenueCat

### Secondary: Stripe (Deprecated/Web)
**File**: `/src/services/subscriptionService.js`

Placeholder for Stripe integration (web/subscription management):
- `createCheckoutSession()` - Initiate Stripe checkout
- `createPortalSession()` - Stripe customer portal
- `getSubscription()` - Fetch subscription from DB
- `cancelSubscription()` - Cancel subscription
- `updateSubscriptionTier()` - Change tier

**Status**: Requires backend API setup for production

---

## 7. ENVIRONMENT CONFIGURATION

### Feature Flags (`.env`)

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Payment Processing
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_xxxxxxxxxxxxxxxx
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_xxxxxxxxxxxxxxxx

# Feature Flags
EXPO_PUBLIC_ENABLE_AUTH=false              # Show login screen
EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS=true      # Enforce tier restrictions
EXPO_PUBLIC_MOCK_PREMIUM=false             # Bypass all tier checks
```

### Configuration Modes

| Mode | AUTH | SUBSCRIPTIONS | MOCK_PREMIUM | Result |
|------|------|---------------|--------------|--------|
| Development | false | false | true | No login, all features |
| Testing | true | false | true | Login available, all features |
| Demo | true | true | false | Full gating (real tiers) |

---

## 8. FEATURE GATING LOCATIONS IN CODE

### Components Using Feature Gates

1. **MenuSelector.js** (Channels/Overlays)
   - `canAccessChannel()` - Locks channels by tier
   - Shows lock icon and "PRO required" text

2. **App.js / MainScreen.js**
   - Limit animation frames via `getMaxFrames()`
   - Show/hide ads via `shouldDisplayAds()`

3. **Overlays** (via isOverlayAllowed)
   - Lightning, NWS, SPC, Radar overlays

4. **Products** (via isProductAllowed)
   - Multiple RGB products

5. **Domains** (via isLocalDomainAllowed)
   - Local vs regional domains

---

## 9. CURRENT IMPLEMENTATION STATUS

### Implemented ✅
- Three-tier feature configuration
- Feature gating logic and helpers
- Authentication context with subscription state
- Local preferences storage (AsyncStorage)
- RevenueCat SDK integration (for mobile)
- Feature gate component
- Environment-based feature flags
- Developer tier override for testing

### Requires Setup 🔄
- Supabase backend configuration
- RevenueCat dashboard setup (requires iOS/Android app IDs)
- Stripe backend for web/alternative payments
- Webhook handlers for subscription updates

### Testing Options 🧪
1. **No Auth**: Set `EXPO_PUBLIC_ENABLE_AUTH=false`
2. **Mock Premium**: Set `EXPO_PUBLIC_MOCK_PREMIUM=true`
3. **Dev Tier Override**: Programmatic override via `setDeveloperTierOverride()`

---

## 10. DATA FLOW DIAGRAM

```
User Sign Up/Sign In
         ↓
    Supabase Auth
         ↓
   Load Subscription
  (from subscriptions table)
         ↓
   AuthContext Sets Tier
         ↓
   Components Check Access
  (via hasFeatureAccess, etc.)
         ↓
   Show/Hide Features
    Based on Tier
         ↓
   User Purchases via
   RevenueCat or Stripe
         ↓
   Webhook Updates Tier
    in Supabase
         ↓
   UI Re-renders with
   New Permissions
```

---

## 11. KEY FILES SUMMARY

| File | Purpose |
|------|---------|
| `/src/config/subscription.js` | Tier definitions and feature flags |
| `/src/context/AuthContext.js` | Auth state, subscription management |
| `/src/context/AppContext.js` | UI state, user preferences |
| `/src/services/purchases.js` | RevenueCat integration (mobile) |
| `/src/services/subscriptionService.js` | Stripe/Supabase operations |
| `/src/components/FeatureGate.js` | Wrapper for gating components |
| `/src/screens/SubscriptionScreen.js` | Subscription UI and upgrades |
| `/src/components/MenuSelector.js` | Example of feature gating in use |

---

## 12. TIER COMPARISON TABLE

| Feature | FREE | PRO | PRO_PLUS |
|---------|------|-----|----------|
| Price | $0 | $1.99/mo | $4.99/mo |
| Max Animation Frames | 6 | 24 | 36 |
| All Products | ✗ | ✓ | ✓ |
| All Channels | ✗ | ✓ | ✓ |
| Local Domains | ✗ | ✓ | ✓ |
| Lightning Overlays | ✗ | ✓ | ✓ |
| NWS Overlays | ✗ | ✓ | ✓ |
| SPC Overlays | ✗ | ✓ | ✓ |
| Radar Overlays | ✗ | ✗ | ✓ |
| High Res Images | ✗ | ✓ | ✓ |
| Offline Caching | ✗ | ✓ | ✓ |
| Auto Refresh | ✗ | ✓ | ✓ |
| Inspector Mode | ✗ | ✓ | ✓ |
| Custom Time Select | ✗ | ✗ | ✓ |
| Ads | ✓ | ✗ | ✗ |

