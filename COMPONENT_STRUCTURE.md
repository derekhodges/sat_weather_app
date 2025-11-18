# Satellite Weather App - Component & Data Flow Diagram

## Component Hierarchy

```
App.js (Root)
├── ErrorUtils.setGlobalHandler() ─────────────────────────┐
├── GestureHandlerRootView                                 │
│   └── SafeAreaProvider                                   │
│       └── AuthProvider                                   │
│           └── AppProvider                                │
│               └── AuthGate                               │
│                   ├── (if not authenticated) ───────────► AuthScreen.js
│                   │
│                   └── MainScreen.js ◄─────────────────────┤
│                       ├── TopBar.js                       │
│                       │   ├── Menu Button                 │
│                       │   ├── Satellite Selector Modal    │
│                       │   ├── Favorites Button            │
│                       │   └── Refresh Button              │
│                       │                                   │
│                       ├── MenuSelector.js                 │
│                       │   ├── ChannelPanel                │
│                       │   ├── RGBPanel                    │
│                       │   ├── DomainPanel                 │
│                       │   └── OverlaysPanel               │
│                       │                                   │
│                       ├── SatelliteImageViewer.js         │
│                       │   └── (displays satellite image)  │
│                       │                                   │
│                       ├── BottomControls.js               │
│                       │   ├── Inspector Button            │
│                       │   ├── Location Button             │
│                       │   ├── Play/Pause Button           │
│                       │   ├── Draw Button                 │
│                       │   ├── Share Button                │
│                       │   ├── Reset View Button           │
│                       │   └── Orientation Button          │
│                       │                                   │
│                       ├── TimelineSlider.js               │
│                       ├── ColorScaleBar.js                │
│                       ├── DomainMapSelector.js            │
│                       ├── DrawingOverlay.js               │
│                       ├── CenterCrosshairInspector.js     │
│                       ├── FavoritesMenu.js                │
│                       ├── ShareMenu.js                    │
│                       │                                   │
│                       ├── SettingsModal.js                │
│                       │   ├── Animation Settings          │
│                       │   ├── Display Settings            │
│                       │   ├── Location Settings           │
│                       │   ├── Subscription Testing        │
│                       │   └── NEW: Feedback Section ──────┼──► FeedbackModal.js (NEW)
│                       │                                   │
│                       ├── SubscriptionScreen.js           │
│                       │                                   │
│                       ├── AdBanner.js                     │
│                       │                                   │
│                       ├── TutorialOverlay.js              │
│                       │                                   │
│                       └── BoundaryOverlay.js              │
│                                                           │
└───────────────────────────────────────────────────────────┘
      (Logs errors through analytics.js)
```

## State Management Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    App.js                               │
│         (Global Error Handler Setup)                    │
└─────────────────┬───────────────────────────────────────┘
                  │
    ┌─────────────▼────────────────┐
    │    AuthProvider              │
    │  ┌──────────────────────┐    │
    │  │ AuthContext State:   │    │
    │  │ - user              │    │
    │  │ - session           │    │
    │  │ - subscriptionTier  │    │
    │  │ - devTierOverride   │    │
    │  │ - loading           │    │
    │  └──────────────────────┘    │
    └──────────┬─────────────────────
               │
    ┌──────────▼──────────────────┐
    │   AppProvider               │
    │ ┌────────────────────────┐  │
    │ │ AppContext State:      │  │
    │ │                        │  │
    │ │ Satellite Selection:   │  │
    │ │ - selectedSatellite   │  │
    │ │ - selectedDomain      │  │
    │ │ - selectedChannel     │  │
    │ │ - selectedRGBProduct  │  │
    │ │ - viewMode            │  │
    │ │                        │  │
    │ │ Image/Animation:       │  │
    │ │ - currentImageUrl     │  │
    │ │ - isAnimating         │  │
    │ │ - availableTimestamps │  │
    │ │ - currentFrameIndex   │  │
    │ │                        │  │
    │ │ UI State:             │  │
    │ │ - activeMenu          │  │
    │ │ - showSettingsModal   │  │
    │ │ - showFeedbackModal ◄─┼─ NEW
    │ │ - feedbackCategory ◄──┼─ NEW
    │ │ - feedbackMessage  ◄──┼─ NEW
    │ │ - showSubscriptionModal
    │ │ - showFavoritesMenu   │  │
    │ │ - layoutOrientation   │  │
    │ │                        │  │
    │ │ Settings:             │  │
    │ │ - settings (object)   │  │
    │ │ - updateSettings()    │  │
    │ │                        │  │
    │ │ Drawing:              │  │
    │ │ - isDrawingMode       │  │
    │ │ - drawings            │  │
    │ │                        │  │
    │ │ Inspector:            │  │
    │ │ - isInspectorMode     │  │
    │ │ - inspectorValue      │  │
    │ │                        │  │
    │ │ Location:             │  │
    │ │ - userLocation        │  │
    │ │ - savedHomeLocation   │  │
    │ │ - showLocationMarker  │  │
    │ │                        │  │
    │ │ Overlays:             │  │
    │ │ - overlayStates       │  │
    │ │ - toggleOverlay()     │  │
    │ │                        │  │
    │ │ Favorites:            │  │
    │ │ - favorites           │  │
    │ │ - setFavorites()      │  │
    │ │                        │  │
    │ │ Geospatial:           │  │
    │ │ - currentGeoData      │  │
    │ │ - inspectorCoordinates
    │ │                        │  │
    │ └────────────────────────┘  │
    └─────────────────────────────┘
```

## Service Architecture

```
┌──────────────────────────────────────────────┐
│          Services Directory                  │
├──────────────────────────────────────────────┤
│                                              │
│  analytics.js (Error & Event Tracking)      │
│  ├── initAnalytics()                        │
│  ├── trackEvent()                           │
│  ├── trackScreenView()                      │
│  ├── trackFeatureUsage()                    │
│  ├── logError() ◄──── Used by App.js        │
│  ├── getErrorLogs()                         │
│  ├── clearErrorLogs()                       │
│  ├── flushEvents()                          │
│  ├── getAnalyticsSummary()                  │
│  └── getRecentErrors() (NEW)                │
│                                              │
│  feedbackService.js (NEW)                   │
│  ├── submitFeedback()                       │
│  ├── getFeedbackQueue()                     │
│  └── clearFeedbackQueue()                   │
│                                              │
│  subscriptionService.js                     │
│  ├── getSubscriptionStatus()                │
│  └── validateSubscription()                 │
│                                              │
│  purchases.js                               │
│  ├── initPurchases()                        │
│  └── handlePurchase()                       │
│                                              │
└──────────────────────────────────────────────┘
```

## Data Persistence

```
┌─────────────────────────────────────────┐
│      Local Storage (AsyncStorage)       │
├─────────────────────────────────────────┤
│                                         │
│ @user_preferences ──────────────────┐  │
│ @saved_favorites ───────────────┐   │  │
│ @sat_weather_error_log          │   │  │
│ devTierOverride                 │   │  │
│ @analytics_events_* (backup)    │   │  │
│ @feedback_queue (NEW) ◄─────────┼───┼─ feedbackService.js
│                                 │   │
│                     ┌───────────┘   │
│                     │               │
│              AppContext State  Settings UI
│                                     │
└─────────────────────────────────────┘
          │
          │ (if network available)
          ▼
┌──────────────────────────────────────────┐
│         Backend (Supabase)               │
├──────────────────────────────────────────┤
│                                          │
│ Tables:                                  │
│ - users (auth)                          │
│ - subscriptions                         │
│ - user_feedback (NEW)                   │
│ - analytics_events (optional)           │
│                                          │
└──────────────────────────────────────────┘
```

## Error Tracking Flow

```
┌─────────────────────────────────────┐
│  Error Occurs in Component           │
└──────────────┬──────────────────────┘
               │
        ┌──────▼──────┐
        │ Where?      │
        └──┬────┬────┬┘
          /     │     \
   Global      Try/Catch  Component
   Handler     Block       Error
    │          │           │
    │          │           │
    ▼          ▼           ▼
┌──────────────────────────────────────┐
│   logError() in analytics.js          │
│   (context, message, stack, etc.)    │
└──────────┬─────────────────────────────┘
           │
      ┌────┴──────────┬──────────────┐
      │               │              │
      ▼               ▼              ▼
  Track      Store Locally    Console Log
  Event      (AsyncStorage)   (in dev)
                │
                ▼
  Queue for Upload to
  Backend when online

Result: getErrorLogs() returns stored errors
        Can be shown in Settings or attached
        to user feedback
```

## Feedback Submission Flow (NEW)

```
User initiates feedback
      │
      ▼
FeedbackModal.js
  ├── Select Category
  ├── Enter Message
  ├── Optional: Include Error Logs
  └── Submit
      │
      ▼
submitFeedback() in feedbackService.js
      │
      ├─────────────────┬──────────────┐
      │                 │              │
      ▼                 ▼              ▼
   Track        Queue Locally    Send to Supabase
   Event        (AsyncStorage)   (if online)
   │            │                │
   │            ├────────────────┘
   │            │
   │            └─► Retry on reconnect
   │
   └─► User gets success/error feedback

Supabase user_feedback table:
├── message
├── category (bug, feature, general, other)
├── subscription_tier
├── session_id (for investigation)
├── error_logs (attached if available)
├── created_at
├── reviewed (admin flag)
├── response
└── response_date
```

## Key Integration Points for Feedback

```
SettingsModal.js (existing)
    │
    └─► NEW: Feedback Section
        └─► Button: "Send Us Your Feedback"
            │
            ▼
        FeedbackModal.js (NEW)
            │
            ├─► Uses: AppContext (for feedback state)
            ├─► Uses: AuthContext (for tier info)
            ├─► Uses: feedbackService.js (to submit)
            └─► Uses: analytics.js (to get error logs)
                │
                ▼
            Supabase Backend
```

## File Modification Summary

```
EXISTING FILES:
├── App.js (already has global error handler)
├── src/context/AppContext.js (add feedback state)
├── src/components/SettingsModal.js (add feedback button)
└── src/services/analytics.js (add helper functions)

NEW FILES:
├── src/services/feedbackService.js
└── src/components/FeedbackModal.js

BACKEND:
└── Supabase: Create user_feedback table
```

## Component Communication Pattern

```
TopBar.js
    │
    └─► setShowSettingsModal(true) ──┐
                                      │
                                      ▼
SettingsModal.js
    │
    ├─► Shows various settings sections
    │
    └─► NEW: "Send Feedback" button ──┐
            │                          │
            └─► setShowFeedbackModal(true)
                        │
                        ▼
                FeedbackModal.js
                    │
                    ├─► Gets state from AppContext
                    ├─► Gets subscription tier from AuthContext
                    ├─► Gets error logs from analytics.js
                    │
                    └─► submitFeedback() ──► feedbackService.js
                            │
                            ├─► AsyncStorage (queue)
                            └─► Supabase (send)
```

