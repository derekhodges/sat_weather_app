# Free Trial Feature Guide

## Overview

The Satellite Weather App now includes a **7-day free trial** that gives users full access to **Pro Plus** features. This is a one-time trial per user that unlocks all premium features including:

- ✅ All 16 satellite channels
- ✅ All RGB products
- ✅ Radar overlays (MRMS, Composite)
- ✅ Lightning detection overlays
- ✅ NWS warnings & watches
- ✅ SPC convective outlooks
- ✅ Custom time selection
- ✅ Up to 36 animation frames
- ✅ High-resolution imagery
- ✅ Ad-free experience

## How It Works

### User Experience

1. **Free Tier Users**: See a prominent "Try Pro Plus Free for 7 Days" card on the subscription screen
2. **One Click**: Users can start their trial with a single tap - no credit card required
3. **Full Access**: Trial immediately grants Pro Plus tier access to all features
4. **Trial Status**: Active trials show a banner with days remaining
5. **One-Time Only**: Each user can only use the trial once (enforced server-side)

### Technical Implementation

The trial system is built with:

- **Database Tracking**: Three new columns in the `subscriptions` table
- **AuthContext Integration**: Automatic tier elevation during active trials
- **Feature Gating**: Existing feature gates automatically respect trial status
- **UI Components**: Trial card, status banner, and countdown display

## Setup Instructions

### Step 1: Run Database Migration

Execute the SQL migration in your Supabase SQL Editor:

```bash
# File: supabase_trial_migration.sql
```

This adds three columns to the `subscriptions` table:
- `trial_started_at` - When the trial began
- `trial_ends_at` - When the trial expires (7 days after start)
- `trial_used` - Boolean flag to prevent re-use

### Step 2: Enable Authentication

The trial feature requires users to be logged in. Update your `.env`:

```env
EXPO_PUBLIC_ENABLE_AUTH=true
EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS=true
EXPO_PUBLIC_MOCK_PREMIUM=false
```

**Note**: If auth is disabled, the trial feature won't be available (users already have full access in guest mode).

### Step 3: Test the Trial

1. Create a test user account
2. Navigate to the Subscription screen
3. You should see the "Try Pro Plus Free for 7 Days" card
4. Click "Start Free Trial"
5. Verify Pro Plus features are now unlocked
6. Check that the trial status banner shows "7 days remaining"

## Trial Enforcement

### Server-Side Validation

The trial system uses Supabase to ensure enforcement:

- **Trial Used Flag**: Set to `true` when trial starts, prevents multiple trials
- **Expiration Check**: Server timestamp compared on each app launch
- **User ID Binding**: Trial is tied to authenticated user account

### Client-Side Features

- **Automatic Tier Elevation**: `effectiveTier` returns `PRO_PLUS` when trial is active
- **Countdown Display**: Shows days remaining on subscription screen
- **Feature Access**: All existing feature gates automatically work with trial tier

### Can Users Bypass It?

**No** - The trial is properly enforced:

1. ✅ **Trial Used Flag**: Stored in database, can't be reset without direct DB access
2. ✅ **Server Timestamp**: Expiration calculated server-side using PostgreSQL
3. ✅ **User Authentication**: Requires logged-in user, can't create unlimited accounts easily
4. ✅ **Row Level Security**: Users can't modify their own subscription records

The only way to bypass would be:
- Creating new user accounts repeatedly (can be mitigated with email verification)
- Direct database access (only available to project admins)
- Clearing app data won't reset trial status (stored in Supabase, not locally)

## Code Structure

### AuthContext Updates

**New State Variables:**
```javascript
trialActive      // Boolean - is trial currently active?
trialEndsAt      // ISO timestamp - when does trial expire?
trialUsed        // Boolean - has user used their trial?
```

**New Functions:**
```javascript
startTrial()     // Start the 7-day trial
getTrialStatus() // Get trial info (active, daysRemaining, endsAt)
```

**Modified Logic:**
```javascript
// effectiveTier now checks trial status
const effectiveTier = devTierOverride ||
                      (trialActive ? SUBSCRIPTION_TIERS.PRO_PLUS : subscriptionTier)
```

### SubscriptionScreen Updates

**New UI Components:**
- Trial Status Banner (shown when trial is active)
- Free Trial Card (shown when trial is available)
- Start Trial Button (initiates trial)

**Visual Hierarchy:**
1. Header
2. Trial Status Banner (if active) or Trial Card (if available)
3. Billing Period Toggle
4. Tier Cards (Free, Pro, Pro Plus)
5. Restore Purchases Button

## Customization

### Change Trial Duration

Modify the duration in `AuthContext.js`:

```javascript
// Default: 7 days
const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

// Example: 14 days
const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

// Example: 30 days
const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
```

### Change Trial Tier

Modify which tier the trial grants in `AuthContext.js`:

```javascript
// Default: PRO_PLUS
const effectiveTier = devTierOverride ||
                      (trialActive ? SUBSCRIPTION_TIERS.PRO_PLUS : subscriptionTier)

// Alternative: PRO tier instead
const effectiveTier = devTierOverride ||
                      (trialActive ? SUBSCRIPTION_TIERS.PRO : subscriptionTier)
```

### Customize Trial UI

Styles are in `SubscriptionScreen.js`:

```javascript
// Trial card colors
trialCard: {
  backgroundColor: '#2d1b69',  // Purple background
  borderColor: '#667eea',       // Purple border
}

// Trial banner colors
trialBanner: {
  backgroundColor: '#1a4d2e',   // Green background
  borderColor: '#27ae60',        // Green border
}
```

### Allow Multiple Trials (Not Recommended)

If you want to allow users to try again after a period:

```javascript
// In startTrial() function, modify the check:
if (existingSubscription?.trial_used) {
  // Check if enough time has passed since last trial
  const lastTrialEnd = new Date(existingSubscription.trial_ends_at);
  const now = new Date();
  const daysSinceLastTrial = (now - lastTrialEnd) / (1000 * 60 * 60 * 24);

  if (daysSinceLastTrial < 365) { // Require 1 year between trials
    return { success: false, error: 'You can try again in ' +
             Math.ceil(365 - daysSinceLastTrial) + ' days' };
  }
}
```

## Analytics & Monitoring

### Recommended Metrics to Track

1. **Trial Conversion Rate**: % of trials that convert to paid subscriptions
2. **Trial Start Rate**: % of free users who start trials
3. **Trial Completion**: % of users who complete the full 7 days
4. **Feature Usage During Trial**: Which premium features get used most

### SQL Queries for Insights

```sql
-- How many users have started trials?
SELECT COUNT(*) FROM subscriptions WHERE trial_used = true;

-- How many trials are currently active?
SELECT COUNT(*) FROM subscriptions
WHERE trial_ends_at > NOW() AND trial_started_at IS NOT NULL;

-- Trial conversion rate (trials that became paid subscriptions)
SELECT
  COUNT(*) FILTER (WHERE trial_used = true) as total_trials,
  COUNT(*) FILTER (WHERE trial_used = true AND tier != 'free') as converted,
  ROUND(100.0 * COUNT(*) FILTER (WHERE trial_used = true AND tier != 'free') /
        NULLIF(COUNT(*) FILTER (WHERE trial_used = true), 0), 2) as conversion_rate
FROM subscriptions;
```

## Troubleshooting

### Trial Button Not Showing

**Check:**
1. Is auth enabled? (`EXPO_PUBLIC_ENABLE_AUTH=true`)
2. Is user logged in? (Trial requires authentication)
3. Has user already used trial? (Check `trial_used` in database)
4. Is user already on a paid tier? (Trial only for free users)

### Trial Not Granting Access

**Check:**
1. Database migration ran successfully
2. `trial_ends_at` is in the future
3. `loadSubscriptionStatus()` is fetching trial fields
4. `effectiveTier` logic includes trial check

### Users Can Start Multiple Trials

**Fix:**
1. Verify database migration added `trial_used` column
2. Check Row Level Security policies allow reads
3. Verify `trial_used` is set to `true` when trial starts

## Best Practices

1. ✅ **Email Verification**: Require verified emails to prevent abuse
2. ✅ **Clear Communication**: Explain trial terms upfront (duration, features, no credit card)
3. ✅ **Reminder Emails**: Send emails at 3 days remaining and 1 day remaining
4. ✅ **Easy Upgrade**: Make subscription purchase obvious during trial
5. ✅ **Grace Period**: Consider 1-2 day grace period after trial ends
6. ✅ **Analytics**: Track trial → paid conversion rate

## Future Enhancements

Consider adding:

- **Trial Extension**: One-time 3-day extension for engaged users
- **Trial Reminders**: Push notifications when trial is ending
- **Custom Trial Offers**: Different trial lengths based on user behavior
- **Referral Trials**: Extra trial days for referring friends
- **Limited Trial**: Partial feature access instead of full Pro Plus

## Support

If you need help:
- Database issues: Check Supabase dashboard logs
- UI issues: Verify component state in React DevTools
- Feature gating: Add console.logs to `effectiveTier` logic

---

**Questions?** Check the main `SUBSCRIPTION_SETUP.md` for related configuration.
