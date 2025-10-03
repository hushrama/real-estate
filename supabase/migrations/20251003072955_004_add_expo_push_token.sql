/*
  # Add Expo Push Token Support

  ## Overview
  Adds support for storing Expo Push Notification tokens to enable real-time
  notifications for sellers when buyers create requests.

  ## Changes

  ### Modified Tables
  
  #### `profiles`
    - Add `expo_push_token` (text, nullable) - Stores Expo push notification token
    - Users can update their own token via mobile app registration

  ## Important Notes
    - Expo push tokens are obtained from the Expo Notifications SDK in the mobile app
    - Tokens should be refreshed periodically as they can expire
    - Users can have multiple devices, but this implementation stores one token per user
    - For production, consider creating a separate `push_tokens` table for multi-device support
*/

-- =============================================
-- ADD EXPO PUSH TOKEN COLUMN
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'expo_push_token'
  ) THEN
    ALTER TABLE profiles ADD COLUMN expo_push_token text;
  END IF;
END $$;

-- Create index for faster lookups when sending notifications
CREATE INDEX IF NOT EXISTS idx_profiles_expo_push_token 
  ON profiles(expo_push_token) 
  WHERE expo_push_token IS NOT NULL;

-- =============================================
-- UPDATE RLS POLICY FOR EXPO TOKEN
-- =============================================

-- Users should be able to update their own expo_push_token
-- (already covered by existing "Users can update own profile" policy)