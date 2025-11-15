# Subscription System Setup Guide

This guide explains how to complete the subscription system setup for your Satellite Weather App.

## Current Status

✅ **Completed:**
- Subscription tier configuration
- Feature flag system
- Authentication context and screens
- Supabase client setup
- Auth screens with "Skip" option
- Environment configuration
- Package dependencies added

🔄 **Not Yet Active (Requires Configuration):**
- Supabase backend
- Stripe payment processing
- Database tables

## Quick Start (Testing Without Auth)

The app is configured to work WITHOUT authentication enabled. You can test all features:

1. **Environment Settings** (in `.env`):
   ```env
   EXPO_PUBLIC_ENABLE_AUTH=false
   EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS=false
   EXPO_PUBLIC_MOCK_PREMIUM=true
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Start the App:**
   ```bash
   npm start
   ```

With these settings, the app:
- ✅ Skips authentication screens
- ✅ Grants access to all premium features
- ✅ Works exactly as before

## Setting Up Supabase (When Ready)

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and anon key

### Step 2: Create Database Tables

Run this SQL in your Supabase SQL Editor:

```sql
-- Users table (handled by Supabase Auth automatically)

-- Subscriptions table
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

-- Enable Row Level Security
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own subscription
CREATE POLICY "Users can read own subscription"
  ON subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can manage all subscriptions (for webhooks)
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions
  FOR ALL
  USING (auth.role() = 'service_role');
```

### Step 3: Update Environment Variables

In `.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

EXPO_PUBLIC_ENABLE_AUTH=true
EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS=false  # Keep false until Stripe is set up
EXPO_PUBLIC_MOCK_PREMIUM=false
```

### Step 4: Test Authentication

1. Restart your app
2. You'll see the login screen (with "Continue as Guest" option)
3. Create an account to test sign up
4. Verify email functionality works

## Setting Up Stripe (When Ready)

### Step 1: Create Stripe Account

1. Go to [stripe.com](https://stripe.com)
2. Create an account
3. Get your publishable key (test mode)

### Step 2: Create Products and Prices

In Stripe Dashboard:

1. Create product: "Premium"
   - Monthly price: $4.99
   - Yearly price: $49.99
   - Copy the price IDs

2. Create product: "Premium Plus"
   - Monthly price: $9.99
   - Yearly price: $99.99
   - Copy the price IDs

### Step 3: Update Stripe Configuration

In `src/services/subscriptionService.js`:
```javascript
export const STRIPE_PRICE_IDS = {
  [SUBSCRIPTION_TIERS.PREMIUM]: {
    monthly: 'price_xxxxx', // Your actual Stripe price ID
    yearly: 'price_xxxxx',
  },
  [SUBSCRIPTION_TIERS.PREMIUM_PLUS]: {
    monthly: 'price_xxxxx',
    yearly: 'price_xxxxx',
  },
};
```

In `.env`:
```env
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS=true
```

### Step 4: Create Backend API (Required for Stripe)

You need a backend to handle Stripe operations securely. Options:

**Option A: Supabase Edge Functions**
```bash
supabase functions new create-checkout
supabase functions new stripe-webhook
```

**Option B: Separate Backend (Node.js/Express)**
```javascript
// Example endpoints needed:
POST /api/subscription/create-checkout
POST /api/subscription/create-portal
POST /api/subscription/cancel
POST /api/webhooks/stripe
```

### Step 5: Install Stripe SDK

When ready to process payments:
```bash
npm install @stripe/stripe-react-native
```

Then uncomment the Stripe initialization in `src/config/stripe.js`.

## Feature Flags Explained

### `EXPO_PUBLIC_ENABLE_AUTH`
- `false`: Skip login, everyone is a guest
- `true`: Show login screen (can still skip as guest)

### `EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS`
- `false`: Disable subscription checks, all features unlocked
- `true`: Enforce subscription tiers

### `EXPO_PUBLIC_MOCK_PREMIUM`
- `true`: Grant all premium features (for testing)
- `false`: Enforce actual subscription tier

## Testing Scenarios

### Scenario 1: No Auth (Current)
```env
EXPO_PUBLIC_ENABLE_AUTH=false
EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS=false
EXPO_PUBLIC_MOCK_PREMIUM=true
```
Result: App works like before, no changes

### Scenario 2: Auth Enabled, Premium Unlocked
```env
EXPO_PUBLIC_ENABLE_AUTH=true
EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS=false
EXPO_PUBLIC_MOCK_PREMIUM=true
```
Result: Login screen appears, but can skip. All features unlocked.

### Scenario 3: Full Production Mode
```env
EXPO_PUBLIC_ENABLE_AUTH=true
EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS=true
EXPO_PUBLIC_MOCK_PREMIUM=false
```
Result: Login required (or guest mode). Features locked by subscription tier.

## Adding Feature Gates to Components

Example in `src/components/FavoritesMenu.js`:

```javascript
import { useAuth } from '../context/AuthContext';

function FavoritesMenu() {
  const { hasFeatureAccess, showUpgradePrompt } = useAuth();

  const handleAddFavorite = () => {
    // Check if user has access to unlimited favorites
    if (!hasFeatureAccess('maxFavorites')) {
      showUpgradePrompt('Unlimited Favorites');
      return;
    }

    // Proceed with adding favorite
    addToFavorites();
  };
}
```

## Database Schema Reference

### `subscriptions` table columns:
- `id`: UUID primary key
- `user_id`: Foreign key to auth.users
- `tier`: 'free' | 'premium' | 'premium_plus'
- `status`: 'active' | 'cancelled' | 'expired'
- `stripe_customer_id`: Stripe customer ID
- `stripe_subscription_id`: Stripe subscription ID
- `created_at`: Timestamp
- `updated_at`: Timestamp
- `expires_at`: Subscription expiration date

## Troubleshooting

### "Supabase not configured" warning
- Make sure `.env` has valid Supabase URL and key
- Restart your dev server after changing `.env`

### Auth not showing up
- Check `EXPO_PUBLIC_ENABLE_AUTH=true` in `.env`
- Make sure Supabase is configured
- Check App.js has AuthProvider wrapping your components

### Premium features still locked
- Set `EXPO_PUBLIC_MOCK_PREMIUM=true` for testing
- Or set `EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS=false`

## Next Steps

1. ✅ **Now**: Test the app with auth disabled
2. 🔄 **Soon**: Set up Supabase project and enable auth
3. 🔄 **Later**: Set up Stripe and enable subscriptions
4. 🔄 **Future**: Add backend API for payment processing

## Support

For Supabase help: https://supabase.com/docs
For Stripe help: https://stripe.com/docs

---

**Remember**: The app works perfectly fine without any of this setup. Enable features progressively as you're ready!
