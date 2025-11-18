# Quick Reference - Satellite Weather App

## Key Files at a Glance

### Core Files (Entry Points)
```
SatWeatherApp/
├── index.js                          ← Expo entry point
├── App.js                            ← React app root with error handler
└── app.json                          ← Expo configuration
```

### Screens (User Interface Pages)
```
src/screens/
├── MainScreen.js                     ← PRIMARY INTERFACE (1000+ lines)
├── AuthScreen.js                     ← Login/signup
└── SubscriptionScreen.js             ← Premium features
```

### Context (State Management)
```
src/context/
├── AppContext.js                     ← App state (satellites, images, UI)
└── AuthContext.js                    ← User & subscription state
```

### Components
```
src/components/
├── SettingsModal.js (1,144 lines)    ← WHERE TO ADD FEEDBACK
├── MenuSelector.js                   ← Channel/RGB/Domain/Overlay selection
├── TopBar.js                         ← Top menu bar
├── BottomControls.js                 ← Inspector, location, draw, share buttons
├── SatelliteImageViewer.js           ← Main image display
├── TimelineSlider.js                 ← Animation timeline
├── ColorScaleBar.js                  ← Color scale legend
├── DomainMapSelector.js              ← Interactive region picker
├── FavoritesMenu.js                  ← Saved locations
├── DrawingOverlay.js                 ← Drawing mode
├── CenterCrosshairInspector.js       ← Pixel value inspector
└── ... 5 more utility components
```

### Services
```
src/services/
├── analytics.js                      ← Error logging & event tracking
├── subscriptionService.js            ← Tier management
├── purchases.js                      ← In-app purchase handling
└── feedbackService.js (TO CREATE)    ← User feedback submission
```

### Utilities
```
src/utils/
├── logger.js                         ← Development logging (sanitizes secrets)
├── imageService.js                   ← Image URL generation
├── geoDataService.js                 ← Geospatial data handling
├── shareUtils.js                     ← Screenshot/GIF sharing
├── projection.js                     ← Satellite image projection
├── validation.js                     ← Input validation
└── ... more utilities
```

### Configuration
```
src/config/
├── supabase.js                       ← Backend setup
├── subscription.js                   ← Tier definitions
└── stripe.js                         ← Payment processing
```

### Constants
```
src/constants/
├── satellites.js                     ← GOES-19, channels
├── domains.js                        ← Regions (CONUS, Oklahoma, etc)
├── products.js                       ← RGB products (Geocolor, etc)
├── overlays.js                       ← Radar, lightning, warnings
└── colorTables.js                    ← Color mappings
```

---

## Technologies Used

### Language & Runtime
- **React**: 19.1.0
- **React Native**: 0.81.5
- **Expo**: 54.0.23
- **JavaScript/JSX**: Standard

### State & Data
- **State Management**: React Context API (not Redux)
- **Local Storage**: AsyncStorage (@react-native-async-storage)
- **Backend**: Supabase
- **Payments**: RevenueCat (in-app subscriptions)

### UI & Styling
- **UI Framework**: React Native (iOS/Android/Web)
- **Icons**: Ionicons, MaterialCommunityIcons
- **Styling**: StyleSheet (React Native native)
- **Animations**: React Native Reanimated

### Features
- **Location**: Expo Location
- **Maps**: react-native-maps
- **Gestures**: react-native-gesture-handler
- **File I/O**: Expo File System
- **Media**: Expo Image Manipulator, Media Library

---

## Architecture Decisions

### Why React Context (Not Redux)?
- Smaller app scope (single screen)
- Less boilerplate
- Easier to understand
- Good performance with memoization

### Why Supabase (Not Firebase)?
- Open-source compatible
- PostgreSQL (more powerful queries)
- Simpler auth setup
- Better for custom dashboards

### Why Expo (Not Bare React Native)?
- Faster development
- No native code needed
- Web support out of the box
- Easier deployment

---

## Important Patterns

### Error Handling Pattern
```javascript
// Global (in App.js)
ErrorUtils.setGlobalHandler((error, isFatal) => {
  logError(error, 'global_error_handler', { isFatal });
})

// Local (in components)
try {
  // ... code
} catch (error) {
  logError(error, 'component_name', { action: 'save' });
}
```

### State Update Pattern
```javascript
// In AppContext
const [value, setValue] = useState(initialValue);

// In components
const { value, setValue } = useApp();

// Update
setValue(newValue);
```

### Modal Pattern
```javascript
// State controlled by AppContext
const { showSettingsModal, setShowSettingsModal } = useApp();

// Toggle
setShowSettingsModal(true);

// Render
<SettingsModal
  visible={showSettingsModal}
  onClose={() => setShowSettingsModal(false)}
/>
```

---

## Common Tasks

### Adding a New Setting
1. Add state in `AppContext.js`
2. Add UI in `SettingsModal.js`
3. Update `localStorage` in AppContext
4. Use with: `const { setting } = useApp()`

### Tracking User Events
```javascript
import { trackEvent } from '../services/analytics';

trackEvent('feature_name', { property: value });
```

### Logging Errors
```javascript
import { logError } from '../services/analytics';

try {
  // code
} catch (error) {
  logError(error, 'context_name', { additionalInfo: true });
}
```

### Accessing User Subscription
```javascript
const { subscriptionTier, shouldDisplayAds } = useAuth();

if (subscriptionTier === 'free') {
  // Show ads or limit features
}
```

### Storing Data Persistently
```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Save
await AsyncStorage.setItem('@key', JSON.stringify(data));

// Load
const data = await AsyncStorage.getItem('@key');
```

---

## Development Workflow

### Environment Setup
```bash
cd /home/user/sat_weather_app/SatWeatherApp
npm install
```

### Start Development
```bash
npm start          # Expo dev server
npm run web        # Test on web
npm run android    # Test on Android
npm run ios        # Test on iOS
```

### Feature Development Steps
1. **Plan**: Check ARCHITECTURE_ANALYSIS.md
2. **Code**: Create/modify files
3. **Test**: Run on emulator
4. **Track**: Add analytics tracking
5. **Error Handle**: Add error logging
6. **Document**: Update comments

---

## Debugging Tips

### View Error Logs
```javascript
import { getErrorLogs } from '../services/analytics';

const logs = await getErrorLogs();
console.log('Recent errors:', logs);
```

### View Analytics Summary
```javascript
import { getAnalyticsSummary } from '../services/analytics';

const summary = await getAnalyticsSummary();
console.log('Session:', summary.session_id);
console.log('Duration:', summary.session_duration_minutes, 'min');
console.log('Queued events:', summary.queued_events);
```

### Enable All Logging (Dev Only)
```javascript
// In logger.js, change:
const __DEV__ = true; // Force development mode
```

### Check Local Storage
```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

const allKeys = await AsyncStorage.getAllKeys();
allKeys.forEach(async (key) => {
  const value = await AsyncStorage.getItem(key);
  console.log(`${key}:`, value);
});
```

---

## Important Constants

### Subscription Tiers
- `FREE` - Free user (limited frames, ads)
- `PRO` - Pro user (more frames, no ads)
- `PREMIUM` - Premium user (all features)

### View Modes
- `rgb` - RGB product view
- `channel` - Single channel view

### Layouts
- `portrait` - Portrait orientation
- `landscape` - Landscape orientation

### Animation Settings
- Min speed: 100ms
- Max speed: 2000ms
- Max frames (free): 12
- Max frames (pro): 24
- Max frames (premium): 48

---

## File Size Reference

| File | Lines | Purpose |
|------|-------|---------|
| MainScreen.js | 1,400+ | Main UI interface |
| SettingsModal.js | 1,144 | Settings UI |
| MenuSelector.js | 27K | Channel/RGB/Domain selection |
| SatelliteImageViewer.js | 26K | Image display & zoom |
| DomainMapSelector.js | 20K | Interactive region picker |
| analytics.js | 250+ | Error & event tracking |
| AppContext.js | 200+ | App state management |
| AuthContext.js | 150+ | Auth & subscription |

---

## Documentation Files Created

1. **ARCHITECTURE_ANALYSIS.md** (459 lines)
   - Complete app structure breakdown
   - Tech stack details
   - Error handling approach
   - Best location for feedback feature

2. **FEEDBACK_IMPLEMENTATION_GUIDE.md** (499 lines)
   - Step-by-step feedback feature creation
   - Code examples
   - Database schema
   - Integration checklist

3. **COMPONENT_STRUCTURE.md** (358 lines)
   - Visual component hierarchy
   - Data flow diagrams
   - State management architecture
   - Service architecture

4. **This file** - QUICK_REFERENCE.md
   - File organization
   - Quick lookup
   - Common patterns
   - Development tips

---

## Next Steps

### To Add Feedback Feature:
1. Read: FEEDBACK_IMPLEMENTATION_GUIDE.md
2. Create: `src/services/feedbackService.js`
3. Update: `src/context/AppContext.js`
4. Create: `src/components/FeedbackModal.js`
5. Update: `src/components/SettingsModal.js`
6. Backend: Create user_feedback table in Supabase

### To Enhance Error Tracking:
1. Review: ARCHITECTURE_ANALYSIS.md (Section 4)
2. Extend: `src/services/analytics.js`
3. Add: Error context (what user was doing)
4. Dashboard: Optional - create admin panel

---

## Support

### If You Need Help Understanding:
- **Component Hierarchy**: See COMPONENT_STRUCTURE.md
- **Data Flow**: See ARCHITECTURE_ANALYSIS.md Section 1-6
- **Error Handling**: See ARCHITECTURE_ANALYSIS.md Section 4
- **Implementation**: See FEEDBACK_IMPLEMENTATION_GUIDE.md

### Key Contact Points:
- Supabase: `src/config/supabase.js`
- Analytics: `src/services/analytics.js`
- Main UI: `src/screens/MainScreen.js`
- Settings: `src/components/SettingsModal.js`

