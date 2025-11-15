# Mobile Payment Strategy: RevenueCat

## Why RevenueCat is Essential for Your App

### The Problem
- **iOS requires** Apple In-App Purchases for any digital subscriptions
- **Android requires** Google Play Billing for subscriptions
- **You cannot bypass** these stores for digital content (30%/15% commission)
- **Stripe alone won't work** for mobile app subscriptions

### The Solution: RevenueCat
RevenueCat is a wrapper SDK that handles both App Store and Play Store billing with one integration.

## RevenueCat Benefits

1. **Single SDK** - One codebase for iOS and Android
2. **Automatic receipt validation** - Handles fraud prevention
3. **Subscription management** - Handles renewals, cancellations, grace periods
4. **Cross-platform entitlements** - User buys on iOS, works on Android
5. **Analytics dashboard** - See MRR, churn, trials, etc.
6. **Webhooks** - Sync subscription status to your backend
7. **No server required** - Everything runs client-side
8. **Free tier available** - First $2500/month in revenue is free

## Pricing

- **Free**: Up to $2,500/month in revenue
- **Starter**: 0.8% of revenue after $2,500
- **Pro**: Custom pricing for higher volume

## Setup Overview

### 1. Create RevenueCat Account

Go to [revenuecat.com](https://revenuecat.com) and create an account.

### 2. Set Up App Store Connect (iOS)

```
1. Create app in App Store Connect
2. Set up bank/tax info
3. Create in-app purchase products:
   - pro_monthly: $0.99/month
   - pro_yearly: $10/year
   - pro_plus_monthly: $2.99/month
   - pro_plus_yearly: $30/year
4. Submit products for review
```

### 3. Set Up Google Play Console (Android)

```
1. Create app in Google Play Console
2. Set up merchant account
3. Create subscription products:
   - pro_monthly: $0.99/month
   - pro_yearly: $10/year
   - pro_plus_monthly: $2.99/month
   - pro_plus_yearly: $30/year
4. Activate subscriptions
```

### 4. Configure RevenueCat Dashboard

```
1. Create new project in RevenueCat
2. Add iOS app (with App Store shared secret)
3. Add Android app (with service account JSON)
4. Create "Entitlements":
   - "pro" - grants Pro features
   - "pro_plus" - grants Pro Plus features
5. Create "Offerings":
   - Default offering with all 4 products
6. Link products to entitlements
```

### 5. Install SDK

```bash
npm install react-native-purchases
npx pod-install # for iOS
```

### 6. Initialize in App

```javascript
import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

const initializePurchases = async () => {
  const apiKey = Platform.OS === 'ios'
    ? 'appl_your_api_key'
    : 'goog_your_api_key';

  await Purchases.configure({ apiKey });

  // Optional: Identify user (for cross-platform)
  if (userId) {
    await Purchases.logIn(userId);
  }
};
```

### 7. Check Subscription Status

```javascript
import Purchases from 'react-native-purchases';

const checkSubscription = async () => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();

    // Check entitlements
    if (customerInfo.entitlements.active['pro_plus']) {
      return 'pro_plus';
    } else if (customerInfo.entitlements.active['pro']) {
      return 'pro';
    }

    return 'free';
  } catch (error) {
    console.error('Error checking subscription:', error);
    return 'free';
  }
};
```

### 8. Purchase Product

```javascript
import Purchases from 'react-native-purchases';

const purchaseProduct = async (packageId) => {
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current.availablePackages.find(
      p => p.identifier === packageId
    );

    const purchaseResult = await Purchases.purchasePackage(pkg);

    // Check if purchase was successful
    if (purchaseResult.customerInfo.entitlements.active['pro']) {
      // Grant access
      return { success: true, tier: 'pro' };
    }

    return { success: true };
  } catch (error) {
    if (!error.userCancelled) {
      console.error('Purchase error:', error);
    }
    return { success: false, error: error.message };
  }
};
```

## Integration with Your Auth System

### Option 1: RevenueCat Only (Simplest)

```javascript
// In AuthContext.js
const checkEntitlements = async () => {
  const customerInfo = await Purchases.getCustomerInfo();

  if (customerInfo.entitlements.active['pro_plus']) {
    setSubscriptionTier(SUBSCRIPTION_TIERS.PRO_PLUS);
  } else if (customerInfo.entitlements.active['pro']) {
    setSubscriptionTier(SUBSCRIPTION_TIERS.PRO);
  } else {
    setSubscriptionTier(SUBSCRIPTION_TIERS.FREE);
  }
};
```

### Option 2: Supabase + RevenueCat (For User Accounts)

```javascript
// RevenueCat webhook -> Supabase Edge Function
// Updates subscriptions table when purchase/renewal/cancel occurs

// In your backend webhook handler:
app.post('/webhooks/revenuecat', async (req, res) => {
  const event = req.body.event;
  const userId = event.app_user_id;
  const entitlements = event.customer_info?.entitlements?.active || {};

  let tier = 'free';
  if (entitlements.pro_plus) tier = 'pro_plus';
  else if (entitlements.pro) tier = 'pro';

  // Update Supabase
  await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      tier: tier,
      status: 'active',
      updated_at: new Date().toISOString()
    });
});
```

## Product Configuration

### iOS Product IDs
```
com.satweatherapp.pro.monthly
com.satweatherapp.pro.yearly
com.satweatherapp.proplus.monthly
com.satweatherapp.proplus.yearly
```

### Android Product IDs
```
pro_monthly
pro_yearly
pro_plus_monthly
pro_plus_yearly
```

### RevenueCat Entitlements
```json
{
  "entitlements": {
    "pro": {
      "products": [
        "pro_monthly",
        "pro_yearly"
      ]
    },
    "pro_plus": {
      "products": [
        "pro_plus_monthly",
        "pro_plus_yearly"
      ]
    }
  }
}
```

## Testing

### iOS Sandbox Testing
1. Create sandbox test account in App Store Connect
2. Sign out of App Store on device
3. Don't sign back in
4. App will prompt for sandbox account during purchase
5. Subscriptions renew quickly (monthly = 5 minutes)

### Android Test Purchases
1. Add test account emails in Play Console
2. Publish to internal track
3. Test purchases are free
4. Can clear purchase history for retesting

### RevenueCat Debug Mode
```javascript
Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
```

## Migration Path

1. **Now**: Use current tier override system for testing
2. **When Ready**:
   - Create RevenueCat account
   - Set up App Store/Play Store products
   - Install RevenueCat SDK
   - Replace tier override with actual subscription check
3. **Production**:
   - Remove dev tools section
   - Enable real payments

## Stripe for Web (Optional)

If you also want web subscriptions:

```
User buys on web -> Stripe checkout
User buys on mobile -> RevenueCat
Both sync to Supabase via webhooks
User logs in on either platform and gets correct entitlements
```

## Cost Comparison

| Method | Commission | Maintenance |
|--------|-----------|-------------|
| App Store | 15-30% | Low |
| Play Store | 15% | Low |
| RevenueCat | 0-0.8% | Very Low |
| Stripe Direct | 2.9% | **NOT ALLOWED for mobile** |

## Summary

**For your app:**
1. Use **RevenueCat** for iOS and Android subscriptions
2. Use **Supabase** for user accounts (optional)
3. Use **Stripe** only if you want web subscriptions (optional)

RevenueCat handles the complex store APIs and gives you a simple SDK. Your app just checks `customerInfo.entitlements` to know what features to unlock.

## Resources

- [RevenueCat Docs](https://docs.revenuecat.com/)
- [RevenueCat React Native Guide](https://docs.revenuecat.com/docs/reactnative)
- [App Store In-App Purchases](https://developer.apple.com/in-app-purchase/)
- [Google Play Billing](https://developer.android.com/google/play/billing)

---

**Next Step**: Create RevenueCat account and start the free trial. You can test everything with sandbox accounts before going live.
