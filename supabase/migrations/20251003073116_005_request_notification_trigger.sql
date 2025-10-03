/*
  # Database Trigger for Request Notifications

  ## Overview
  Creates a database trigger that automatically invokes the send-request-push Edge Function
  whenever a new request is inserted into the requests table with status='pending'.

  ## How It Works
  1. After a new request is inserted, the trigger fires
  2. The trigger function calls the Edge Function via HTTP using pg_net extension
  3. The Edge Function fetches request details and sends the Expo push notification
  4. All operations are asynchronous - the insert doesn't wait for the notification

  ## Components

  ### 1. Enable pg_net Extension
    - Supabase's pg_net extension allows making HTTP requests from within Postgres
    - Used to call the Edge Function asynchronously

  ### 2. Trigger Function: notify_seller_on_new_request()
    - Fires AFTER INSERT on requests table
    - Only for requests with status='pending'
    - Makes async HTTP POST to Edge Function
    - Passes request_id in JSON payload

  ### 3. Trigger: trigger_request_notification
    - Attached to requests table
    - Calls notify_seller_on_new_request() after each insert

  ## Important Notes
    - The Edge Function URL is constructed from SUPABASE_URL environment variable
    - Notifications are sent asynchronously - insert operations don't block
    - If notification fails, the request is still created (no rollback)
    - The Edge Function handles retries and error logging
    - Uses supabase_functions_admin role for authentication
*/

-- =============================================
-- STEP 1: ENABLE PG_NET EXTENSION
-- =============================================

-- pg_net allows making HTTP requests from Postgres
-- This is pre-installed in Supabase but we enable it explicitly
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- =============================================
-- STEP 2: CREATE TRIGGER FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION notify_seller_on_new_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  edge_function_url text;
  service_role_key text;
  request_payload jsonb;
BEGIN
  -- Only send notification for pending requests
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Get Supabase URL from environment
  supabase_url := current_setting('app.settings.supabase_url', true);
  
  -- Construct Edge Function URL
  -- Format: https://{project-ref}.supabase.co/functions/v1/send-request-push
  edge_function_url := supabase_url || '/functions/v1/send-request-push';

  -- Get service role key for authentication
  service_role_key := current_setting('app.settings.supabase_service_role_key', true);

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
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := request_payload
  );

  -- Log the notification attempt (optional)
  RAISE NOTICE 'Notification triggered for request %', NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Failed to trigger notification for request %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- =============================================
-- STEP 3: CREATE TRIGGER
-- =============================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_request_notification ON requests;

-- Create trigger that fires after insert
CREATE TRIGGER trigger_request_notification
  AFTER INSERT ON requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_seller_on_new_request();

-- =============================================
-- STEP 4: HELPER FUNCTION TO SET CONFIG
-- =============================================

-- Function to set the configuration variables
-- This needs to be called once with your Supabase URL and service role key
CREATE OR REPLACE FUNCTION set_notification_config(
  p_supabase_url text,
  p_service_role_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set the configuration at the database level
  EXECUTE format('ALTER DATABASE %I SET app.settings.supabase_url TO %L', 
    current_database(), p_supabase_url);
  EXECUTE format('ALTER DATABASE %I SET app.settings.supabase_service_role_key TO %L', 
    current_database(), p_service_role_key);
  
  RAISE NOTICE 'Notification configuration set successfully';
END;
$$;

-- =============================================
-- STEP 5: GRANT PERMISSIONS
-- =============================================

-- Grant necessary permissions for the trigger function
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- =============================================
-- INSTRUCTIONS FOR SETUP
-- =============================================

/*
  TO COMPLETE SETUP, RUN THIS ONCE:

  SELECT set_notification_config(
    'https://your-project-ref.supabase.co',  -- Your Supabase URL (from env vars)
    'your-service-role-key-here'              -- Your service role key (from env vars)
  );

  You can get these values from your Supabase dashboard or .env file.
*/