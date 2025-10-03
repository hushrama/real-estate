/*
  # Simplified Request Notification Trigger

  ## Overview
  Replaces the previous trigger with a simpler approach that uses hardcoded
  configuration values. This is necessary because ALTER DATABASE requires
  superuser permissions which are not available in Supabase.

  ## Changes
  1. Drop the old trigger and function
  2. Create a new trigger function with embedded configuration
  3. Uses Supabase's built-in environment variables where available

  ## Important Notes
    - The Edge Function URL is constructed using your Supabase project URL
    - Update the SUPABASE_URL constant in the function if needed
    - The service role key is passed via the edge function's environment
*/

-- =============================================
-- STEP 1: DROP OLD TRIGGER AND FUNCTIONS
-- =============================================

DROP TRIGGER IF EXISTS trigger_request_notification ON requests;
DROP FUNCTION IF EXISTS notify_seller_on_new_request();
DROP FUNCTION IF EXISTS set_notification_config(text, text);

-- =============================================
-- STEP 2: CREATE SIMPLIFIED TRIGGER FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION notify_seller_on_new_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url text;
  request_payload jsonb;
  supabase_anon_key text;
BEGIN
  -- Only send notification for pending requests
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Hardcode your Supabase URL here
  -- Format: https://{project-ref}.supabase.co/functions/v1/send-request-push
  edge_function_url := 'https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/send-request-push';
  
  -- Use anon key for trigger (Edge Function uses service role internally)
  supabase_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJib2x0IiwicmVmIjoiMGVjOTBiNTdkNmU5NWZjYmRhMTk4MzJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODE1NzQsImV4cCI6MTc1ODg4MTU3NH0.9I8-U0x86Ak8t2DGaIk0HfvTSLsAyzdnz-Nw00mMkKw';

  -- Prepare payload
  request_payload := jsonb_build_object(
    'request_id', NEW.id::text
  );

  -- Make async HTTP request to Edge Function using pg_net
  -- This doesn't block the INSERT operation
  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || supabase_anon_key,
      'apikey', supabase_anon_key
    ),
    body := request_payload
  );

  -- Log the notification attempt (optional - disable in production for performance)
  -- RAISE NOTICE 'Notification triggered for request %', NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Failed to trigger notification for request %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- =============================================
-- STEP 3: RECREATE TRIGGER
-- =============================================

CREATE TRIGGER trigger_request_notification
  AFTER INSERT ON requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_seller_on_new_request();

-- =============================================
-- VERIFICATION
-- =============================================

/*
  The trigger is now active and will automatically invoke the Edge Function
  whenever a new request is created.

  To test:
  1. Insert a test request using the create_request function
  2. Check the Edge Function logs in Supabase Dashboard
  3. Verify the notification was sent
*/