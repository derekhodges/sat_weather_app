# User Feedback System - Setup & Usage Guide

## Overview

The feedback system allows users to submit bug reports, feature requests, and general feedback directly from the app. It includes:

- **FeedbackModal**: User-friendly form with category selection, message input, and optional email
- **feedbackService**: Handles submission to Supabase with offline queueing
- **Error Log Integration**: Optional attachment of recent error logs for debugging
- **Analytics Tracking**: Tracks feedback submissions for insights

## Files Added/Modified

### New Files
1. `src/services/feedbackService.js` - Core feedback submission logic
2. `src/components/FeedbackModal.js` - User interface for feedback form
3. `supabase_feedback_schema.sql` - Database schema for Supabase
4. `FEEDBACK_SETUP.md` - This documentation file

### Modified Files
1. `src/components/SettingsModal.js` - Added "Send Feedback" button in Help & Support section

## Setup Instructions

### 1. Set Up Supabase Table

1. Open your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `supabase_feedback_schema.sql`
4. Run the SQL to create the `user_feedback` table and associated policies

### 2. Verify Environment Configuration

Ensure your `.env` file has Supabase credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Install Dependencies (Already Installed)

The feedback system uses existing dependencies:
- `@supabase/supabase-js` - Database connection
- `@react-native-async-storage/async-storage` - Offline storage
- `@expo/vector-icons` - Icons

## Usage

### For Users

1. Open the app
2. Tap the **Settings** icon (gear icon)
3. Scroll to **Help & Support** section
4. Tap **Send Feedback**
5. Select a category (Bug Report, Feature Request, Performance, UI/UX, or General)
6. Enter feedback message
7. Optionally provide email for follow-up
8. Optionally include recent error logs (recommended for bug reports)
9. Tap **Send Feedback** button

### Feedback Categories

- **Bug Report**: Report issues or unexpected behavior
- **Feature Request**: Suggest new features or improvements
- **Performance**: Report performance issues or slowness
- **UI/UX**: Provide feedback on user interface or experience
- **General**: Any other feedback or comments

## Features

### 1. Offline Support

- Feedback is queued locally if Supabase is unavailable
- Automatically retries submission when connection is restored
- Max 20 queued feedback items

### 2. Error Log Attachment

- Users can optionally attach recent error logs (last 10 errors)
- Helps with debugging bug reports
- Error logs include:
  - Error message and stack trace
  - Session ID
  - Platform and version info
  - Timestamp
  - Context where error occurred

### 3. Automatic Device Info

All feedback includes:
- Platform (iOS/Android)
- Platform version
- App version
- Session information
- Timestamp

### 4. Analytics Integration

Feedback submissions are tracked via the analytics service:
- Event: `feedback_submitted`
- Properties: category, has_email, includes_errors, error_count

## Testing

### Manual Testing

1. **Submit feedback without Supabase** (offline mode):
   ```bash
   # Temporarily disable Supabase in .env
   # EXPO_PUBLIC_SUPABASE_URL=
   ```
   - Verify feedback is queued locally
   - Check AsyncStorage for `@sat_weather_feedback_queue`

2. **Submit feedback with Supabase** (online mode):
   - Ensure Supabase is configured
   - Submit feedback
   - Check Supabase dashboard for new row in `user_feedback` table

3. **Test different categories**:
   - Submit feedback for each category
   - Verify category is correctly stored

4. **Test with error logs**:
   - Enable "Include recent error logs"
   - Verify error_logs JSON field in database

5. **Test email validation**:
   - Submit with valid email
   - Submit without email (should work)
   - Verify email is stored correctly

### Automated Testing Checklist

- [ ] Feedback submission with all required fields
- [ ] Feedback submission without optional fields
- [ ] Offline queueing when Supabase unavailable
- [ ] Retry mechanism for queued feedback
- [ ] Error log attachment
- [ ] Analytics event tracking
- [ ] Form validation (empty message)
- [ ] Modal dismiss with unsaved changes
- [ ] Success/error alert messages

## Database Schema

### user_feedback Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Reference to auth.users (nullable) |
| message | TEXT | Feedback message (required) |
| category | TEXT | Category enum (required) |
| email | TEXT | Optional email for follow-up |
| platform | TEXT | iOS/Android |
| platform_version | TEXT | OS version |
| app_version | TEXT | App version |
| error_logs | JSONB | Array of error objects |
| submitted_at | TIMESTAMP | When user submitted |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

### Row Level Security (RLS) Policies

1. **Anyone can submit feedback**: Allows authenticated and anonymous users to insert
2. **Users can view their own feedback**: Users can only see their submitted feedback
3. **Admin access**: Service role can view all feedback (for admin dashboard)

## Viewing Feedback (Admin)

### Option 1: Supabase Dashboard

1. Go to Supabase Dashboard
2. Navigate to Table Editor
3. Select `user_feedback` table
4. View all submissions

### Option 2: SQL Query

```sql
-- Recent feedback
SELECT
  id,
  category,
  message,
  email,
  platform,
  submitted_at
FROM user_feedback
ORDER BY submitted_at DESC
LIMIT 50;

-- Feedback by category
SELECT
  category,
  COUNT(*) as count
FROM user_feedback
GROUP BY category
ORDER BY count DESC;

-- Recent bug reports with error logs
SELECT
  id,
  message,
  error_logs,
  submitted_at
FROM user_feedback
WHERE category = 'bug_report'
  AND error_logs IS NOT NULL
ORDER BY submitted_at DESC;
```

### Option 3: Feedback Stats View

A pre-built view `feedback_stats` provides aggregated statistics:

```sql
SELECT * FROM feedback_stats
WHERE date >= NOW() - INTERVAL '30 days'
ORDER BY date DESC;
```

## Troubleshooting

### Feedback not submitting

1. Check Supabase configuration in `.env`
2. Verify Supabase table exists and RLS policies are correct
3. Check console logs for errors
4. Verify network connection

### Error: "Failed to submit feedback"

- Check if Supabase is configured: `isSupabaseConfigured()` should return true
- Verify RLS policies allow INSERT for anon/authenticated users
- Check Supabase logs in dashboard

### Feedback queued but not retrying

- Call `retryQueuedFeedback()` manually from feedbackService
- Check if Supabase became available
- Verify queued items in AsyncStorage: `@sat_weather_feedback_queue`

### Error logs not attaching

- Verify analytics service is initialized
- Check if errors are being logged via `logError()`
- Verify AsyncStorage has error logs: `@sat_weather_error_log`

## Future Enhancements

Potential improvements:

1. **Admin Dashboard**: Build a React Native admin view to manage feedback
2. **Email Notifications**: Send email to admins when new feedback arrives
3. **Status Tracking**: Allow users to track feedback status (open/in-progress/resolved)
4. **Feedback Reply**: Allow admins to reply to user feedback
5. **File Attachments**: Allow users to attach screenshots
6. **Sentiment Analysis**: Analyze feedback sentiment automatically
7. **Search & Filter**: Admin tools to search and filter feedback

## API Reference

### feedbackService.js

#### `submitFeedback(options)`

Submits user feedback to Supabase.

**Parameters:**
- `message` (string, required): Feedback message
- `category` (string, required): Feedback category
- `email` (string, optional): User email for follow-up
- `includeErrorLogs` (boolean, optional): Attach error logs
- `userId` (string, optional): User ID if authenticated

**Returns:** Promise<Object>
```javascript
{
  success: boolean,
  queued?: boolean,
  id?: string,
  message: string,
  error?: string
}
```

**Example:**
```javascript
import { submitFeedback, FeedbackCategory } from '../services/feedbackService';

const result = await submitFeedback({
  message: "App crashes when I select domain",
  category: FeedbackCategory.BUG_REPORT,
  email: "user@example.com",
  includeErrorLogs: true,
});
```

#### `retryQueuedFeedback()`

Retries submitting queued feedback when connection is restored.

**Returns:** Promise<Object>

#### `getQueuedFeedback()`

Gets all queued feedback items.

**Returns:** Promise<Array>

#### `clearQueuedFeedback()`

Clears all queued feedback.

**Returns:** Promise<void>

#### `getFeedbackStats()`

Gets feedback statistics.

**Returns:** Promise<Object>

## Support

For questions or issues with the feedback system:

1. Check this documentation
2. Review console logs for errors
3. Check Supabase logs in dashboard
4. Review the source code in `src/services/feedbackService.js`

## License

Part of Sat Weather App. All rights reserved.
