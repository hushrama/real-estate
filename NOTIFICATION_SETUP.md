# RealEstate Push Notifications Setup

Complete guide for setting up Expo Push Notifications for the RealEstate platform.

---

## 📋 Overview

This system automatically sends Expo Push Notifications to sellers when buyers create new requests for their properties. The notification includes:
- Property title
- Buyer name and message
- Deep link to view the request: `myapp://seller/requests/{request_id}`

## 🏗️ Architecture

```
New Request Created
    ↓
Database Trigger (AFTER INSERT on requests)
    ↓
Edge Function: send-request-push (via pg_net HTTP call)
    ↓
Fetch request details from database
    ↓
Send Expo Push Notification (with retry logic)
    ↓
Seller receives notification on mobile device
```

---

## ⚙️ Environment Variables

All environment variables are automatically configured in Supabase:

### Edge Function Environment
- `SUPABASE_URL` - Your Supabase project URL (auto-configured)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access (auto-configured)
- `LOG_LEVEL` - Optional, defaults to `info` (options: `error`, `warn`, `info`, `debug`)

### Database Trigger
- The trigger function has the Supabase URL and anon key embedded
- No additional configuration required

---

## 🚀 Deployment Status

### ✅ Completed Setup

1. **Database Schema**
   - ✅ Added `expo_push_token` column to `profiles` table
   - ✅ Created index on `expo_push_token` for faster lookups

2. **Edge Function**
   - ✅ Deployed `send-request-push` function
   - ✅ Handles Expo Push API communication
   - ✅ Implements retry logic (3 attempts with exponential backoff)
   - ✅ Comprehensive error logging

3. **Database Trigger**
   - ✅ Created `notify_seller_on_new_request()` trigger function
   - ✅ Attached to `requests` table AFTER INSERT
   - ✅ Uses `pg_net` extension for async HTTP calls
   - ✅ Does not block request creation if notification fails

---

## 📱 Mobile App Integration

### Step 1: Install Expo Notifications SDK

```bash
npx expo install expo-notifications expo-device expo-constants
```

### Step 2: Request Permission and Get Token

```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabaseClient';

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }

    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('Expo Push Token:', token);

    // Save token to database
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({ expo_push_token: token })
        .eq('id', user.id);
    }
  } else {
    alert('Must use physical device for Push Notifications');
  }

  return token;
}

// Call this when user logs in or app starts
registerForPushNotificationsAsync();
```

### Step 3: Handle Incoming Notifications

```typescript
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';

// Configure how notifications are displayed
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function useNotifications() {
  const navigation = useNavigation();
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Listener for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    // Listener for when user taps on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;

      // Handle deep link
      if (data.url) {
        // Parse: myapp://seller/requests/{request_id}
        const requestId = data.request_id;
        navigation.navigate('RequestDetails', { requestId });
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, [navigation]);
}
```

---

## 🧪 Testing

### Test 1: Manual Edge Function Invocation

```bash
curl -X POST \
  https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/send-request-push \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Expected Response (Success):**
```json
{
  "success": true,
  "message": "Push notification sent",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "deep_link": "myapp://seller/requests/550e8400-e29b-41d4-a716-446655440000"
}
```

**Expected Response (No Token):**
```json
{
  "success": false,
  "error": "Seller has no push token registered",
  "warning": "Notification not sent - seller needs to enable notifications"
}
```

### Test 2: End-to-End via Database

1. **Setup Test Users:**

```sql
-- Insert test buyer profile
INSERT INTO profiles (id, full_name, phone, role)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'John Buyer',
  '+1234567890',
  'buyer'
);

-- Insert test seller profile with Expo token
INSERT INTO profiles (id, full_name, phone, role, expo_push_token)
VALUES (
  '660e8400-e29b-41d4-a716-446655440001',
  'Jane Seller',
  '+0987654321',
  'seller',
  'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'  -- Replace with real token
);
```

2. **Create Test Property:**

```sql
INSERT INTO properties (id, seller_id, title, description, price, address, city, state, zip_code, status)
VALUES (
  '770e8400-e29b-41d4-a716-446655440002',
  '660e8400-e29b-41d4-a716-446655440001',
  'Beautiful 3BR Home',
  'Stunning property in great location',
  450000,
  '123 Main St',
  'Springfield',
  'IL',
  '62701',
  'available'
);
```

3. **Create Request (triggers notification):**

```sql
SELECT create_request(
  '550e8400-e29b-41d4-a716-446655440000'::uuid,  -- buyer_id
  '770e8400-e29b-41d4-a716-446655440002'::uuid,  -- property_id
  'I would love to schedule a viewing for this weekend!'
);
```

4. **Verify:**
   - Check Supabase Edge Function logs for execution
   - Verify notification appears on seller's device
   - Tap notification and verify deep link navigation

### Test 3: Using Expo Push Notification Tool

For quick testing without a real device:

1. Go to: https://expo.dev/notifications
2. Enter your Expo Push Token
3. Send a test notification
4. Verify it appears on your device

---

## 🔍 Monitoring & Debugging

### View Edge Function Logs

1. Go to Supabase Dashboard
2. Navigate to **Edge Functions** → **send-request-push**
3. Click on **Logs** tab
4. Filter by log level: `error`, `warn`, `info`, `debug`

### Check Trigger Execution

```sql
-- Check if pg_net extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- View recent pg_net requests (if logging is enabled)
-- Note: pg_net doesn't persist logs by default
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Seller has no push token" | Seller hasn't registered for notifications | Ensure mobile app calls `registerForPushNotificationsAsync()` |
| "Invalid Expo push token format" | Token format is incorrect | Token must start with `ExponentPushToken[` or `ExpoPushToken[` |
| "Expo API error: 400" | Invalid token or malformed request | Verify token is valid and not expired |
| "Expo API error: 429" | Rate limited | Edge function will retry automatically |
| "Request not found" | Invalid request_id | Ensure request exists in database |
| Notification not sent | Database trigger failed | Check Edge Function logs and pg_net connectivity |

---

## 🔐 Security Notes

1. **Service Role Key**: The Edge Function uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS and fetch request details. This is safe because:
   - The function validates the request exists
   - Only relevant data is fetched and sent
   - The key is not exposed to clients

2. **Expo Push Tokens**: Store tokens securely in the database:
   - RLS ensures users can only update their own tokens
   - Tokens are only accessible to the Edge Function

3. **Deep Links**: Validate deep link URLs in the mobile app:
   - Parse URLs safely
   - Verify user has permission to view the request
   - Handle invalid/malicious URLs gracefully

---

## 📊 Notification Payload Structure

### Expo Push Message Format

```typescript
{
  "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "sound": "default",
  "title": "New request for Beautiful 3BR Home",
  "body": "John Buyer is interested in your property: \"I would love to schedule a viewing...\"",
  "data": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "property_id": "770e8400-e29b-41d4-a716-446655440002",
    "url": "myapp://seller/requests/550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Deep Link Format

```
myapp://seller/requests/{request_id}
```

Update `myapp` to match your app's URL scheme defined in `app.json`:

```json
{
  "expo": {
    "scheme": "myapp"
  }
}
```

---

## 🚦 Retry Logic

The Edge Function implements automatic retry logic for transient failures:

- **Max Retries**: 3 attempts
- **Retry Conditions**:
  - HTTP 5xx server errors
  - HTTP 429 rate limiting
  - Network errors
- **Backoff Strategy**: Exponential (1s, 2s, 3s)
- **No Retry**: 4xx client errors (except 429)

---

## 📈 Performance Considerations

1. **Async Execution**: The database trigger uses `pg_net.http_post()` which is fire-and-forget
   - Request creation is NOT blocked by notification sending
   - If notification fails, request is still created

2. **Indexing**: The `expo_push_token` column is indexed for fast lookups

3. **Batch Notifications**: For high-volume scenarios, consider:
   - Implementing a queue system
   - Batching multiple notifications
   - Using Expo's batch notification API

---

## 🔄 Future Enhancements

- [ ] Support multiple devices per user (separate `push_tokens` table)
- [ ] Add notification preferences (email, SMS, push)
- [ ] Implement read receipts
- [ ] Track notification delivery status via Expo's receipt API
- [ ] Add notification templates for different event types
- [ ] Support rich media in notifications (images, buttons)

---

## 📞 Support

For issues or questions:
1. Check Edge Function logs in Supabase Dashboard
2. Verify Expo token format and validity
3. Test with Expo's notification tool: https://expo.dev/notifications
4. Review Expo documentation: https://docs.expo.dev/push-notifications/overview/

---

## ✅ Checklist

- [x] Database migration applied (`expo_push_token` column added)
- [x] Edge Function deployed
- [x] Database trigger created
- [x] Trigger configured with Supabase URL
- [ ] Mobile app updated to register for notifications
- [ ] Mobile app handling deep links
- [ ] End-to-end testing completed
- [ ] Production Expo account configured (for production apps)

---

**Last Updated**: 2025-10-03
**Version**: 1.0.0
