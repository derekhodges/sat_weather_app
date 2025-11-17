# React Native/Expo Satellite Weather App - Performance Audit Report

## Executive Summary
The application demonstrates solid foundational architecture with several excellent performance practices already in place (frame caching, request deduplication, RAF cleanup). However, there are critical memory management issues, unnecessary re-render patterns, and resource cleanup gaps that need immediate attention.

---

## CRITICAL ISSUES (MUST FIX)

### 1. Memory Leak in MainScreen Animation Loop
**Severity: CRITICAL**
**Location:** `MainScreen.js` lines 322-348

**Issue:**
The animation interval is set up in a useEffect that depends on `[isAnimating, availableTimestamps.length, settings.animationSpeed]`, but the interval is being cleared EVERY time these dependencies change, creating a pattern that could leak timers.

**Problem Code:**
```javascript
useEffect(() => {
  if (animationIntervalRef.current) {
    clearInterval(animationIntervalRef.current);
    animationIntervalRef.current = null;
  }
  
  if (isAnimating) {
    animationIntervalRef.current = setInterval(() => {
      setCurrentFrameIndex((prev) => {
        if (prev >= availableTimestamps.length - 1) {
          return 0;
        }
        return prev + 1;
      });
    }, settings.animationSpeed);
  }
  
  return () => {
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
  };
}, [isAnimating, availableTimestamps.length, settings.animationSpeed]);
```

**Risk:** If `settings.animationSpeed` changes frequently (e.g., during user interaction), multiple intervals can accumulate before old ones are cleaned up.

**Fix:** Add debouncing or separate the dependencies - animation speed shouldn't trigger a full effect restart.

---

### 2. AutoRefresh Interval Memory Leak
**Severity: CRITICAL**
**Location:** `MainScreen.js` lines 350-450

**Issue:**
The auto-refresh effect depends on many props and dependencies. Every time any dependency changes, the old interval is cleared and a new one is created. The `isMounted` flag is used, but the async operations inside could still cause issues.

**Risk:** 
- When user switches domains/products during active auto-refresh, timers may not be properly cleaned up
- Async `generateValidatedTimestampArray()` calls could complete after component unmount, causing state updates
- The `isMounted` check only catches top-level execution but not promise chains

**Impact:** 
- Memory accumulation over long app sessions
- Potential "can't perform a React state update on unmounted component" warnings
- Increased battery drain on devices with poor garbage collection

---

### 3. RAF Cleanup Incomplete in SatelliteImageViewer
**Severity: CRITICAL**
**Location:** `SatelliteImageViewer.js` lines 414-440

**Issue:**
While RAF IDs are tracked and cancelled on unmount, there's a complex cascade of RAF calls where inner RAF ids might not all be properly tracked:

```javascript
const rafId1 = requestAnimationFrame(() => {
  const rafId2 = requestAnimationFrame(() => {
    if (isMountedRef.current) {
      setImageALoaded(true);
    }
  });
  rafIdsRef.current.push(rafId2);  // RAFid2 is tracked
});
rafIdsRef.current.push(rafId1);    // RAFid1 is tracked
```

**Risk:** While both are pushed, if the outer RAF callback is skipped, the inner one might still execute.

---

### 4. GeoData Cache Never Evicts During Active Use
**Severity: CRITICAL**
**Location:** `geoDataService.js` lines 34-74

**Issue:**
The cache cleanup runs every 10 minutes but uses TTL (30 min) and LRU eviction based on access time. However, if a user continuously uses the app without unmounting:
- Cache metadata is updated on EVERY access
- If cache never exceeds MAX_CACHE_SIZE (50), items are never evicted by LRU
- A long-running app session could accumulate large GeoData objects indefinitely

**Risk:**
```javascript
// This happens EVERY time geo data is accessed
if (cacheMetadata.has(cacheKey)) {
  cacheMetadata.get(cacheKey).lastAccess = Date.now();
}
```

Every single access updates metadata, but if size < 50, nothing is evicted.

**Impact:** 
- For active users (> 2-3 hours), memory usage grows linearly
- No hard memory limit enforcement during session

---

### 5. DrawingOverlay Path Array Accumulation Without Limits
**Severity: HIGH**
**Location:** `DrawingOverlay.js` lines 59-100

**Issue:**
The drawing paths are stored in `drawings` state array in AppContext with no limit:
```javascript
addDrawing({
  path: pathRef.current,        // Unbounded array
  color: drawingColor,
  id: Date.now(),
});
```

Each path can contain hundreds of points: `{ x: 123, y: 456 }`. If user draws for extended periods, this array grows without bound.

**Risk:** 
- A complex drawing with 1000+ strokes could consume several MB of memory
- Re-rendering SVG with thousands of paths becomes very slow
- No mechanism to limit drawing complexity

---

### 6. App Context Provides ALL State to All Components
**Severity: MEDIUM-HIGH** (architectural issue)
**Location:** `AppContext.js` lines 442-534

**Issue:**
The AppContext value object contains:
- 50+ state variables
- 30+ setter functions
- Every component using `useApp()` subscribes to ALL state changes

This means every component that uses the context will re-render when ANY state changes, even if they don't use that state.

**Example:** A component that only uses `selectedDomain` will re-render when `isAnimating`, `drawings`, `currentImageTransform`, etc. change.

---

## IMPORTANT OPTIMIZATIONS (SHOULD DO)

### 1. Missing React.memo on Multiple Components
**Location:** Multiple components

**Issue:**
- `MenuSelector.js` - renders large lists of channels/products but has no memo
- `TimelineSlider.js` - likely re-renders on every frame during animation
- `ColorScaleBar.js` - re-renders on every state change
- Various overlay components

**Impact:** During animation loops (60 frames/second), these components re-render 60x/sec unnecessarily.

**Fix:** Wrap with `React.memo()` and implement custom comparison if needed.

---

### 2. useCallback Missing in Gesture Handlers
**Location:** `SatelliteImageViewer.js` lines 80-370

**Issue:**
Gesture handlers are recreated on every render:
```javascript
const pinchGesture = Gesture.Pinch()
  .onStart((event) => { ... })
  .onUpdate((event) => { ... })
  .onEnd(() => { ... });
```

These should be memoized to prevent gesture handler recreation.

---

### 3. frameCache.prefetchFrames Loads All at Batches Without Prioritization
**Severity: MEDIUM**
**Location:** `frameCache.js` lines 100-145

**Issue:**
While batching is good, there's a problem:
```javascript
for (let i = 0; i < priorityOrder.length; i += batchSize) {
  const batch = priorityOrder.slice(i, i + batchSize);
  const batchResults = await Promise.all(  // Waits for ALL in batch
    batch.map(...)
  );
  results.push(...batchResults);
}
```

This WAITS for all frames in a batch to complete before starting the next batch. If frames 0-2 are requested and frame 0 takes 5s while frames 1-2 take 1s, it still waits 5s before starting frame 3.

**Better approach:** Use a concurrent queue with priority.

---

### 4. No Lazy Loading of Overlay Components
**Location:** `SatelliteImageViewer.js` lines 640-663

**Issue:**
BoundaryOverlay, VectorOverlay, LocationMarker are ALWAYS mounted:
```javascript
<BoundaryOverlay ... />      // Always renders
<VectorOverlay ... />        // Always renders  
<LocationMarker />           // Always renders
<GeoDataDebugInfo />         // Always renders
```

If these aren't being used, they still consume resources (especially vector rendering for polygons).

---

### 5. Unoptimized Image Slot Swapping Logic
**Severity: MEDIUM**
**Location:** `SatelliteImageViewer.js` lines 372-395

**Issue:**
The dual image slot mechanism is complex:
```javascript
if (activeSlot === 'A') {
  setImageBLoaded(false);
  setImageSlotB(currentImageUrl);
} else {
  setImageALoaded(false);
  setImageSlotA(currentImageUrl);
}
```

This pattern can cause unnecessary re-renders. The component needs to track:
- Two image URLs
- Two loaded states
- Active slot
- Two opacity values

That's 6 state variables just for image swapping.

---

### 6. Location Refresh Runs Every 5 Minutes Even in Background
**Location:** `MainScreen.js` lines 160-167

**Issue:**
```javascript
locationRefreshIntervalRef.current = setInterval(() => {
  if (appStateRef.current === 'active') {
    console.log('[LOCATION] Background refresh...');
    fetchAndCacheLocation();
  }
}, 5 * 60 * 1000);
```

The interval still runs even when app is backgrounded. While `appStateRef.current` check prevents execution, the interval TIMER is still consuming resources.

**Better:** Cancel the interval when app goes to background.

---

## MINOR IMPROVEMENTS (COULD DO)

### 1. Excessive Console Logging
**Location:** Throughout codebase (MainScreen.js, imageService.js, geoDataService.js, etc.)

**Issue:**
```javascript
console.log(`[LOCATION] Fetching initial location...`);
console.log(`[IMAGE] Loaded with dimensions: ${width}x${height}`);
console.log('GeoData cache hit:', cacheKey);
console.log(`Prefetched geospatial data: ${results.size}/${timestamps.length} frames`);
```

Excessive console.log calls can slow down JavaScript execution, especially:
- During animation loops (16ms frames)
- During rapid state changes
- On lower-end devices

**Fix:** Only log in dev mode or reduce verbosity.

---

### 2. Unoptimized SVG Path Generation
**Location:** `DrawingOverlay.js` lines 93-101

**Issue:**
```javascript
const pathToSvgPath = (points) => {
  if (points.length === 0) return '';
  
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;  // String concatenation
  }
  return path;
};
```

String concatenation in loops is inefficient. Should use array.join() or a string builder.

---

### 3. Timezone Conversion on Every Render
**Location:** `imageService.js` lines 280-318, and MainScreen usage

**Issue:**
`formatTimestamp()` is called potentially every frame during animation:
```javascript
<Text style={styles.landscapeTimestamp}>
  {formatTimestamp(imageTimestamp, settings.useLocalTime)}
</Text>
```

Date parsing and formatting happens on every render. This should be memoized.

---

### 4. Large Image Resolution in Cover Mode
**Location:** `SatelliteImageViewer.js` lines 578-584

**Issue:**
In cover mode, images are rendered at 200% size:
```javascript
const imageWrapperStyle = effectiveDisplayMode === 'cover'
  ? [styles.imageWrapper, styles.imageWrapperCover]
  : styles.imageWrapper;

// In styles:
imageWrapperCover: {
  width: '200%',
  height: '200%',
}
```

This doubles GPU memory usage for the satellite image. For a 2000x2000 image, that's 4x memory.

---

### 5. Validate GeoData Structure Not Cached
**Location:** `geoDataService.js` lines 200-213

**Issue:**
Every time GeoData is fetched from server, it's validated:
```javascript
const geoData = await response.json();
const validatedData = validateGeoData(geoData, domain);
```

But the result is cached. However, the validated structure is always re-created even for cached items, wasting processing.

---

## POTENTIAL CRASHES & STABILITY CONCERNS

### 1. Race Condition in Frame Loading
**Location:** `MainScreen.js` lines 212-300

**Issue:**
```javascript
const validFrames = await generateValidatedTimestampArray(...);

if (!isMounted) return;  // <-- Check happens AFTER async

// ... later
setAvailableTimestamps(timestamps);  // <-- Could race with other updates
setCurrentFrameIndex(timestamps.length - 1);
```

If user switches domain while frame validation is happening, multiple async operations could race.

**Scenario:**
1. User loads CONUS
2. During frame validation, user switches to Oklahoma
3. CONUS validation completes and calls `setAvailableTimestamps`
4. Oklahoma validation completes and calls `setAvailableTimestamps`
5. Both try to update state, causing race condition

---

### 2. ImageSize State Update Race
**Location:** `MainScreen.js` lines 603-616

**Issue:**
```javascript
const handleImageLoad = useCallback((event) => {
  setActualImageSize(prev => {
    if (prev && prev.width === width && prev.height === height) {
      return prev;
    }
    return { width, height };
  });
}, [setActualImageSize]);
```

This is called when images load, but `currentImageTransform` depends on this:
```javascript
const updateTransformState = (s, tx, ty) => {
  setCurrentImageTransform(prev => {
    if (prev.scale === s && prev.translateX === tx && prev.translateY === ty) {
      return prev;
    }
    return { scale: s, translateX: tx, translateY: ty };
  });
};
```

If image size changes during gesture handling, the transform math could use stale values.

---

### 3. Unmounted Component State Updates
**Location:** `MainScreen.js` lines 365-440 (auto-refresh) and `SatelliteImageViewer.js` (load handlers)

**Issue:**
Multiple async operations can complete after unmount:
- `generateValidatedTimestampArray()` - 20-30 second operation
- `fetchGeoData()` - 10 second timeout
- `Image.prefetch()` - network dependent

If user navigates away while these are pending, they'll try to setState on unmounted component.

The code tries to prevent this with `isMounted` check, but only partially:
```javascript
if (!isMounted) return;  // <-- Only prevents setState, not promise cleanup
```

The promises still execute in the background.

---

### 4. AppState Listener Not Cleaned Up Properly
**Location:** `MainScreen.js` lines 147-157

**Issue:**
```javascript
const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

// ... much later
return () => {
  if (locationRefreshIntervalRef.current) {
    clearInterval(locationRefreshIntervalRef.current);
  }
  appStateSubscription.remove();  // <-- Good
};
```

While the subscription IS removed, the timing could be an issue if effect dependency changes cause re-subscriptions.

---

### 5. GeoData Updates Without Boundary Checks
**Location:** `MainScreen.js` lines 310-320

**Issue:**
```javascript
useEffect(() => {
  if (actualImageSize && availableTimestamps.length > 0 && currentFrameIndex >= 0) {
    const timestamp = availableTimestamps[currentFrameIndex];
    loadGeoDataForTimestamp(timestamp, product);  // <-- No check if currentFrameIndex < length
  }
}, [actualImageSize]);
```

While there's a length > 0 check, there's no explicit check that `currentFrameIndex < availableTimestamps.length` before accessing. If `currentFrameIndex` gets out of sync, this could crash.

---

## SUMMARY TABLE

| Issue | Severity | Type | Impact | Effort |
|-------|----------|------|--------|--------|
| Animation Loop Cleanup | CRITICAL | Memory | Memory leak, timer accumulation | Medium |
| AutoRefresh Memory Leak | CRITICAL | Memory | Memory accumulation, state updates after unmount | Medium |
| RAF Cleanup Gaps | CRITICAL | Memory | RAF callbacks might not cancel | Low |
| GeoData Cache Eviction | CRITICAL | Memory | Unbounded memory growth | Low |
| Drawing Path Limits | HIGH | Memory | OOM on extended drawing | Low |
| App Context Re-renders | HIGH | Performance | Unnecessary re-renders | High |
| Missing React.memo | HIGH | Performance | 60x re-renders during animation | Medium |
| Image Slot Swapping | MEDIUM | Performance | Complex state management | High |
| Frame Prefetch Batching | MEDIUM | Performance | Sequential batching inefficiency | Low |
| Overlay Lazy Loading | MEDIUM | Performance | Resources wasted on unused overlays | Medium |
| Race Conditions | MEDIUM | Stability | State sync issues | Medium |
| Console Logging | LOW | Performance | Execution slowdown | Low |
| SVG Path Generation | LOW | Performance | String inefficiency | Low |

---

## RECOMMENDED PRIORITY

### Phase 1 (Week 1) - Critical Memory Fixes
1. Fix animation interval cleanup pattern
2. Fix auto-refresh async cleanup
3. Add drawing path limits (max 10,000 points per drawing, max 100 drawings)
4. Implement hard memory limit in GeoData cache

### Phase 2 (Week 2) - Performance Optimizations
1. Split AppContext into smaller contexts (UI, Data, Settings)
2. Add React.memo to list components
3. Implement lazy loading for overlays
4. Optimize image slot swapping with useMemo

### Phase 3 (Week 3) - Cleanup & Refinement
1. Reduce console logging
2. Optimize timestamp formatting with memoization
3. Add request abortion for cancelled operations
4. Implement proper error boundaries

---

