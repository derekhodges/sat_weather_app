# Satellite Weather App

A cross-platform React Native mobile application for viewing real-time satellite imagery from GOES satellites with advanced features including RGB products, domain selection, overlays, and drawing annotations.

## Features

### Current Implementation

- **Multi-Satellite Support**: GOES-19 (East) with placeholders for GOES-17 and GOES-18 (West)
- **RGB Products**:
  - Geocolor (True Color)
  - Airmass
  - Dust
  - Split Window
  - Cloud Microphysics
  - Day Land Cloud Fire
  - Day Snow Fog
  - Night Fog

- **Domain Selection**:
  - Full Disk (entire hemisphere)
  - CONUS (Continental United States)
  - Regional views (Northwest, Northeast, Southwest, Southeast)
  - Local/State views (Oklahoma, Texas, Mesoscale 1 & 2)
  - Interactive map-based domain selection

- **Channel Selection**: All 16 GOES ABI channels
  - Visible channels (1-6)
  - Infrared channels (7-16)

- **Image Controls**:
  - Pinch-to-zoom
  - Pan/scroll
  - Reset zoom
  - Animation playback with timeline slider
  - Color scale bar with channel/product info

- **Drawing & Annotation**:
  - Draw on satellite images
  - Multiple marker colors (Red, Yellow, Green, Blue, White, Orange)
  - Clear drawings
  - Persistent annotations during session

- **Overlays** (UI implemented, data integration pending):
  - Lightning (GLM Flash, GLM Groups)
  - Radar (MRMS, Composite Radar)
  - NWS Products (Warnings, Watches, Mesoscale Discussions)
  - SPC Products (Convective Outlook, Tornado Probabilities)
  - Boundaries (County lines, State lines, Cities)

- **Additional Features**:
  - GPS location tracking
  - Save home location
  - Share satellite images to social media
  - Dark theme optimized for weather viewing

### Data Source

Currently using **College of DuPage (COD) Weather** as a data placeholder. The app is architected to easily switch to AWS S3 when your custom satellite processing pipeline is ready.

Example COD URLs:
- Oklahoma Geocolor: `https://weather.cod.edu/data/satellite/local/Oklahoma/truecolor/Oklahoma.truecolor.YYYYMMDD.HHMMSS.jpg`
- CONUS Geocolor: `https://weather.cod.edu/data/satellite/continental/conus/truecolor/conus.truecolor.YYYYMMDD.HHMMSS.jpg`

## Project Structure

```
SatWeatherApp/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── BottomControls.js
│   │   ├── ColorScaleBar.js
│   │   ├── DomainMapSelector.js
│   │   ├── DrawingOverlay.js
│   │   ├── MenuSelector.js
│   │   ├── SatelliteImageViewer.js
│   │   ├── TimelineSlider.js
│   │   └── TopBar.js
│   ├── constants/          # App configuration
│   │   ├── domains.js
│   │   ├── overlays.js
│   │   ├── products.js
│   │   └── satellites.js
│   ├── context/            # State management
│   │   └── AppContext.js
│   ├── screens/            # Main screens
│   │   └── MainScreen.js
│   └── utils/              # Helper functions
│       └── imageService.js
├── legacy_android/         # Original Android Studio app
└── App.js                  # Application entry point
```

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Expo CLI: `npm install -g expo-cli`
- For iOS: macOS with Xcode
- For Android: Android Studio with Android SDK
- Expo Go app on your mobile device (for testing)

### Installation

1. **Clone the repository**:
   ```bash
   cd sat_weather_app/SatWeatherApp
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Google Maps API (for Android)**:
   - Get a Google Maps API key from [Google Cloud Console](https://console.cloud.google.com/)
   - Open `app.json`
   - Replace `YOUR_GOOGLE_MAPS_API_KEY` with your actual API key

4. **Start the development server**:
   ```bash
   npm start
   ```

5. **Run on device/simulator**:
   - **iOS**: Press `i` in the terminal or scan QR code with Camera app
   - **Android**: Press `a` in the terminal or scan QR code with Expo Go app
   - **Web**: Press `w` in the terminal

## Usage Guide

### Basic Navigation

1. **Selecting Satellite Products**:
   - Tap the satellite name in the top bar to switch satellites
   - Use the bottom menu to select RGB products or individual channels

2. **Menu Options** (4 main menus):
   - **SELECT CHANNEL**: Choose from 16 ABI channels
   - **RGB**: Select RGB composite products (Geocolor, Airmass, etc.)
   - **DOMAIN**: Choose viewing area (Full Disk, CONUS, Regional, Local)
   - **OVERLAYS**: Toggle weather overlays (Lightning, Radar, etc.)

3. **Bottom Controls** (6 buttons):
   - **Satellite Icon**: Quick satellite selector
   - **Location Pin**: Get current GPS location or use saved home
   - **Play/Pause**: Animate through recent satellite imagery
   - **Brush**: Enter drawing mode to annotate images
   - **Share**: Save or share current view
   - **Expand**: Reset zoom and pan

4. **Domain Selection**:
   - Tap "DOMAIN" in menu
   - Choose quick access (Full Disk, CONUS)
   - Or tap "Regional" or "Local" for interactive map
   - Tap regions on map to select specific area

5. **Drawing on Images**:
   - Tap the brush icon to enter drawing mode
   - Tap the color palette to change marker color
   - Draw with your finger on the image
   - Tap trash icon to clear all drawings
   - Tap brush icon again to exit drawing mode

6. **Animation**:
   - Tap play button to animate through last 20 frames
   - Use timeline slider to manually select specific frame
   - Animation loops automatically

7. **Sharing**:
   - Tap share icon to save image or share to social media
   - Image includes any drawings/annotations

## Switching to AWS

When ready to use your own AWS S3 satellite data:

1. Open `src/utils/imageService.js`
2. Update the `generateAWSImageUrl` function with your S3 bucket structure
3. Modify the `loadImage` function in `src/screens/MainScreen.js` to use AWS instead of COD
4. Update URL patterns to match your processing pipeline output

Example AWS structure:
```
s3://your-bucket/
  ├── GOES-19/
  │   ├── full_disk/
  │   │   └── geocolor/
  │   │       └── YYYYMMDD.HHMMSS.jpg
  │   └── conus/
  │       └── geocolor/
  │           └── YYYYMMDD.HHMMSS.jpg
```

## Development Roadmap

### Implemented ✅
- React Native app structure
- All UI components
- Image viewing with zoom/pan
- RGB products menu
- Domain selection with interactive map
- Drawing/annotation system
- Share functionality
- GPS location
- Animation system
- COD data integration

### Pending 🔄
- Overlay data integration (lightning, radar, NWS products)
- AWS S3 data source integration
- Channel-specific visualization (when not using RGB)
- Offline caching
- Push notifications for severe weather
- Settings panel
- Multiple saved locations
- Custom time selection
- Performance optimizations for animation

## Building for Production

### Android APK
```bash
expo build:android
```

### iOS IPA
```bash
expo build:ios
```

### App Stores
Use EAS Build for submitting to stores:
```bash
npm install -g eas-cli
eas build --platform android
eas build --platform ios
```

## Troubleshooting

### Map not showing (Android)
- Make sure you've added a valid Google Maps API key in `app.json`
- Enable Google Maps SDK for Android in Google Cloud Console

### Images not loading
- Check internet connection
- Verify COD servers are accessible
- Check browser console for CORS issues (if running on web)

### App crashes on startup
- Clear cache: `expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`

## Legacy Android App

The original Android Studio app (Kotlin/Jetpack Compose) has been moved to `legacy_android/sat_weather/` for reference.

## License

Proprietary - All rights reserved

## Contact

For questions or issues, please contact the development team.

---

**Note**: This app is currently configured to use COD Weather satellite imagery as a placeholder. Update the data source configuration when your AWS processing pipeline is ready for production use.
