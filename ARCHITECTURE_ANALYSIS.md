# Satellite Weather App - Architecture Analysis & Feedback/Error Tracking Guide

## Executive Summary
The Satellite Weather App is a React Native application built with Expo, featuring satellite imagery viewing with advanced controls, subscriptions, and a comprehensive error tracking infrastructure. The codebase is well-organized with clear separation of concerns using React Context for state management.

---

## 1. APP STRUCTURE & MAIN ENTRY POINTS

### Entry Point Flow
```
index.js (registerRootComponent)
  ↓
App.js (Global Error Handler + Auth Gate)
  ↓
MainScreen.js (Primary UI Container)
  ├── TopBar.js
  ├── MenuSelector.js
  ├── SatelliteImageViewer.js
  ├── BottomControls.js
  ├── SettingsModal.js ← BEST PLACE FOR FEEDBACK
  ├── TimelineSlider.js
  └── ColorScaleBar.js
```

### Key File Locations (Absolute Paths)
- **Main Entry**: `/home/user/sat_weather_app/SatWeatherApp/App.js`
- **Primary Screen**: `/home/user/sat_weather_app/SatWeatherApp/src/screens/MainScreen.js`
- **Settings Modal**: `/home/user/sat_weather_app/SatWeatherApp/src/components/SettingsModal.js` (1,144 lines)
- **Analytics/Error Service**: `/home/user/sat_weather_app/SatWeatherApp/src/services/analytics.js`
- **Logger Utility**: `/home/user/sat_weather_app/SatWeatherApp/src/utils/logger.js`

---

## 2. TECH STACK

### Core Framework
```json
{
  "react": "19.1.0",
  "react-native": "0.81.5",
  "expo": "~54.0.23",
  "react-native-web": "^0.21.2"
}
```

### Key Libraries
| Category | Library | Version |
|----------|---------|---------|
| State Management | React Context API | Native |
| Storage | AsyncStorage | ^2.2.0 |
| Backend | Supabase | ^2.39.0 |
| Subscriptions | RevenueCat | ^9.6.5 |
| UI Components | Ionicons, MaterialCommunityIcons | Via Expo |
| Animations | React Native Reanimated | ~4.1.1 |
| Gestures | react-native-gesture-handler | ~2.28.0 |
| Maps | react-native-maps | ^1.20.1 |
| File Operations | Expo File System | ^19.0.17 |
| Location | Expo Location | ^19.0.7 |

### Platform Support
- iOS 12.0+ (via Expo)
- Android 8.0+ (via Expo)
- Web (via React Native Web)

---

## 3. SETTINGS/CONFIGURATION UI LOCATION

### Current Settings Implementation
**File**: `/home/user/sat_weather_app/SatWeatherApp/src/components/SettingsModal.js`

The SettingsModal is a full-screen modal with multiple sections:
- **Animation Settings**: Speed, frame count, frame skip, dwell duration
- **Display Settings**: Time format (UTC/Local), channel display mode
- **Location Settings**: Save home location
- **Subscription Testing**: Developer tier override (shown in dev mode)
- **Help & Tutorial**: Reset tutorial overlay

**How it's opened**:
```javascript
// In MainScreen.js (line 1034-1035)
onSettingsPress={() => {
  setShowSettingsModal(true);
}}

// In MainScreen.js (line 1309-1310)
<SettingsModal
  visible={showSettingsModal}
  onClose={() => setShowSettingsModal(false)}
/>
```

**Settings stored in AppContext**:
```javascript
// From AppContext.js
const [settings, setSettings] = useState({
  animationSpeed: 500,           // ms per frame
  endDwellDuration: 1500,       // ms to pause on last frame
  frameCount: 12,               // number of frames
  frameSkip: 0,                 // skip frames
  imageDisplayMode: 'contain',  // 'contain' or 'cover'
  autoRefresh: false,           // auto-refresh latest image
  autoRefreshInterval: 5,       // minutes
  showColorScale: true,         // color scale visibility
  defaultDomain: DEFAULT_DOMAIN,
  defaultViewMode: 'rgb',
  defaultProduct: DEFAULT_RGB_PRODUCT,
  useLocalTime: false,          // UTC vs local time
  channelDisplayMode: 'list',   // 'list' or 'grid'
})
```

### Navigation Menu Structure
**File**: `/home/user/sat_weather_app/SatWeatherApp/src/components/MenuSelector.js`

Menu options controlled via `activeMenu` state:
- `'channel'` - Channel selection panel
- `'rgb'` - RGB product panel
- `'domain'` - Domain/region panel
- `'overlays'` - Overlay toggle panel
- `null` - No menu active

---

## 4. CURRENT ERROR HANDLING & LOGGING

### Existing Error Tracking System
**Location**: `/home/user/sat_weather_app/SatWeatherApp/src/services/analytics.js`

#### Features Already Implemented:
1. **Error Logging with Context**
   ```javascript
   export const logError = async (error, context, additionalInfo = {}) {
     // Stores errors locally with session ID, platform, stack trace
     // Max 50 stored errors (MAX_ERROR_LOGS)
   }
   ```

2. **Error Retrieval**
   ```javascript
   export const getErrorLogs = async () // Get stored errors
   export const clearErrorLogs = async () // Clear error history
   ```

3. **Global Error Handler** (in App.js, line 59-62)
   ```javascript
   ErrorUtils.setGlobalHandler((error, isFatal) => {
     logError(error, 'global_error_handler', { isFatal });
   })
   ```

4. **Event Queue System**
   - Max 100 events queued in memory
   - Flushes every 60 seconds (FLUSH_INTERVAL_MS)
   - Events stored locally as backup
   - Includes: error events, feature usage, analytics

5. **Session Tracking**
   - Session ID generated on app open
   - Session duration tracked on app close
   - Platform and version info logged

#### Logger Utility
**Location**: `/home/user/sat_weather_app/SatWeatherApp/src/utils/logger.js`

Features:
- Disabled in production to prevent performance issues
- Sanitizes sensitive data (passwords, tokens, coordinates)
- Category-based logging: `[LOCATION]`, `[CACHE]`, `[NETWORK]`, `[GEO]`, etc.
- Rate-limited performance tracking

---

## 5. BEST LOCATION FOR USER FEEDBACK SECTION

### RECOMMENDED: Add to SettingsModal.js

**Why SettingsModal?**
1. ✅ Already a major settings/preferences interface
2. ✅ User naturally looks there for app features
3. ✅ Consistent with existing UI patterns
4. ✅ Access to user context (settings, preferences)
5. ✅ Already uses ScrollView for multiple sections
6. ✅ Integrated with subscription tier checking (for pro features)

**Alternative: Separate FeedbackModal Component**
- If feedback needs more space or distinct branding
- Can be triggered from menu or settings
- Should follow same modal pattern as SettingsModal

### Recommended Feedback Features to Implement:
1. **Feedback Form**
   - Text input for user message
   - Category selection (Bug, Feature Request, General Comment)
   - Optional screenshot/error attachment
   - Subscription tier indicator (for priority triaging)

2. **Integration with Error Tracking**
   - Auto-attach recent error logs if user reports bug
   - Include session ID for investigation
   - Show last error summary to user

3. **Local Storage**
   - Store feedback in AsyncStorage before submission
   - Queue feedback if offline (retry on reconnect)
   - Show success/failure confirmation

4. **Backend Integration**
   - Use Supabase (already configured in app)
   - Create `user_feedback` table for storage
   - Real-time notifications to admin

---

## 6. STATE MANAGEMENT ARCHITECTURE

### Context Providers (in App.js)
```javascript
<GestureHandlerRootView>
  <SafeAreaProvider>
    <AuthProvider>           // User auth & subscription tier
      <AppProvider>          // All app state
        <AuthGate />         // Auth routing
```

### AppContext (Primary State)
**File**: `/home/user/sat_weather_app/SatWeatherApp/src/context/AppContext.js`

Major State Groups:
- Satellite/Product Selection
- Image & Animation State
- Overlays & Drawing Mode
- Inspector Mode (pixel sampling)
- Geospatial Data
- UI Menus & Modals
- Favorites & Settings
- Location Tracking

**Key function for adding feedback state**:
```javascript
// In AppContext.js useEffect section:
const [showFeedbackModal, setShowFeedbackModal] = useState(false);
const [feedbackDraft, setFeedbackDraft] = useState(null);
```

### AuthContext (Subscription & Auth)
**File**: `/home/user/sat_weather_app/SatWeatherApp/src/context/AuthContext.js`

Manages:
- User authentication (Supabase)
- Subscription tier (RevenueCat)
- Feature access control
- Developer tier override (testing)

---

## 7. DATA PERSISTENCE & STORAGE

### AsyncStorage Usage
All persistent data uses `@react-native-async-storage/async-storage`:

```javascript
// Examples in codebase:
'@user_preferences'      // Settings
'@saved_favorites'       // Favorite views
'@sat_weather_error_log' // Error logs (max 50)
'devTierOverride'        // Testing override
'@analytics_events_*'    // Event backups
```

### Backend Integration
**Supabase** is configured for:
- User authentication
- Database operations
- Real-time features

**Configuration**:
```javascript
// From config/supabase.js
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
```

---

## 8. MAIN NAVIGATION & MENU SYSTEM

### Menu Controls Flow
```
TopBar.js
  ├── Menu Button → toggles activeMenu in AppContext
  ├── Favorites Button → opens FavoritesMenu.js
  └── Refresh Button → loads latest image

MainScreen.js
  ├── MenuSelector.js (conditional rendering based on activeMenu)
  │   ├── Channel panel
  │   ├── RGB product panel
  │   ├── Domain panel (with map picker)
  │   └── Overlays panel
  │
  └── BottomControls.js
      ├── Inspector (eyedropper)
      ├── Location marker
      ├── Play/Pause animation
      ├── Draw/Edit
      ├── Share
      ├── Reset view
      └── Flip orientation
```

### Modal Management
All modals controlled via AppContext states:
```javascript
showSettingsModal,        // Settings & preferences
showSubscriptionModal,    // Subscription/upgrade
showFavoritesMenu,       // Favorite locations
showDomainMap            // Interactive domain selector
```

---

## 9. FRAMEWORKS & TECHNOLOGIES SUMMARY

### Architecture Pattern
- **Framework**: React Native with Expo
- **State Management**: React Context API (not Redux)
- **Routing**: Single screen app (no navigation stack)
- **Styling**: StyleSheet (React Native native)
- **Forms**: Controlled components with TextInput, Switch

### Build & Deployment
- **Build Tool**: Expo EAS (Expo Application Services)
- **Platform Support**: iOS, Android, Web
- **Config File**: `app.json` (Expo config)

### Development Environment
```javascript
// Feature flags available:
EXPO_PUBLIC_ENABLE_AUTH          // Auth toggle
EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS // Subscription enforcement
EXPO_PUBLIC_MOCK_PREMIUM         // Unlock all features
EXPO_PUBLIC_APP_ENV              // development | production
```

---

## 10. IMPLEMENTATION RECOMMENDATIONS

### For Feedback Section:
1. **Add to SettingsModal.js** (after existing settings sections)
2. **Create FeedbackService.js** (mirror analytics.js pattern)
3. **Extend AppContext** with feedback state management
4. **Use Supabase** for backend (already configured)
5. **Follow error tracking pattern** from analytics.js
6. **Implement offline queue** using AsyncStorage

### For Enhanced Error Tracking:
1. **Extend analytics.js** error tracking with:
   - Network error details (API failures)
   - Performance metrics (frame drops, load times)
   - User action context (what user was doing when error occurred)
   
2. **Create ErrorBoundary** component (if needed)
3. **Add crash reporting** integration (Sentry, etc.)
4. **Dashboard for errors** (admin panel)

### Files to Create/Modify:
```
NEW FILES:
├── src/services/feedbackService.js      // Feedback logic
├── src/components/FeedbackModal.js      // OR extend SettingsModal
└── src/screens/AdminDashboard.js        // Optional: error/feedback viewer

MODIFY:
├── src/context/AppContext.js            // Add feedback state
├── src/components/SettingsModal.js      // Add feedback section
└── src/services/analytics.js            // Enhanced tracking
```

---

## 11. QUICK REFERENCE: KEY FILE PATHS

| Component | Location |
|-----------|----------|
| App Entry | `/home/user/sat_weather_app/SatWeatherApp/App.js` |
| Main Screen | `/home/user/sat_weather_app/SatWeatherApp/src/screens/MainScreen.js` |
| App State | `/home/user/sat_weather_app/SatWeatherApp/src/context/AppContext.js` |
| Auth State | `/home/user/sat_weather_app/SatWeatherApp/src/context/AuthContext.js` |
| Settings UI | `/home/user/sat_weather_app/SatWeatherApp/src/components/SettingsModal.js` |
| Analytics | `/home/user/sat_weather_app/SatWeatherApp/src/services/analytics.js` |
| Logger | `/home/user/sat_weather_app/SatWeatherApp/src/utils/logger.js` |
| Menu System | `/home/user/sat_weather_app/SatWeatherApp/src/components/MenuSelector.js` |
| Bottom Controls | `/home/user/sat_weather_app/SatWeatherApp/src/components/BottomControls.js` |
| Top Bar | `/home/user/sat_weather_app/SatWeatherApp/src/components/TopBar.js` |

---

## 12. DEVELOPMENT TIPS

### Running the App
```bash
cd /home/user/sat_weather_app/SatWeatherApp
npm install
npm start          # Start Expo dev server
npm run web        # Web version
npm run android    # Android emulator
npm run ios        # iOS simulator
```

### Testing Feedback Feature
```javascript
// In .env for development:
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS=true
EXPO_PUBLIC_ENABLE_AUTH=false  // Skip login for testing
```

### Debug Error Logs
```javascript
// In MainScreen or anywhere:
import { getErrorLogs, getAnalyticsSummary } from '../services/analytics';

const debugErrors = async () => {
  const logs = await getErrorLogs();
  const summary = await getAnalyticsSummary();
  console.log('Errors:', logs);
  console.log('Summary:', summary);
};
```

### Performance Considerations
- Console.log disabled in production (security & performance)
- Sensitive data filtered before logging
- Event queue limited to 100 items
- Error logs limited to 50 entries
- Analytics flushed every 60 seconds
- Memoized components prevent unnecessary re-renders

---

## Summary Table

| Aspect | Details |
|--------|---------|
| **Language** | JavaScript (React Native) |
| **Runtime** | Expo (iOS, Android, Web) |
| **State** | React Context API |
| **Storage** | AsyncStorage (local), Supabase (backend) |
| **UI Library** | React Native built-ins + Ionicons |
| **Error Handling** | Global handler + service-based logging |
| **Logging** | Development-safe logger + analytics service |
| **Settings UI** | SettingsModal.js (1,144 lines) |
| **Best Practice** | Add feedback section to SettingsModal |
| **Entry Point** | App.js → MainScreen.js |
| **Total Components** | 51 JS files (15 in components/) |

