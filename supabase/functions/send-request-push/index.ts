import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

// =============================================
// TYPES
// =============================================

interface RequestPayload {
  request_id: string;
}

interface RequestDetails {
  id: string;
  buyer_id: string;
  property_id: string;
  seller_id: string;
  message: string | null;
  buyer_name: string;
  buyer_phone: string | null;
  property_title: string;
  seller_expo_token: string | null;
}

interface ExpoPushMessage {
  to: string;
  sound: string;
  title: string;
  body: string;
  data: {
    request_id: string;
    property_id: string;
    url: string;
  };
}

interface ExpoPushResponse {
  data: {
    status: string;
    id?: string;
    message?: string;
    details?: unknown;
  }[];
}

// =============================================
// CONSTANTS
// =============================================

const EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// =============================================
// LOGGING UTILITY
// =============================================

const LOG_LEVEL = Deno.env.get("LOG_LEVEL") || "info";

enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

const logLevelMap: Record<string, LogLevel> = {
  error: LogLevel.ERROR,
  warn: LogLevel.WARN,
  info: LogLevel.INFO,
  debug: LogLevel.DEBUG,
};

const currentLogLevel = logLevelMap[LOG_LEVEL.toLowerCase()] ?? LogLevel.INFO;

function log(level: LogLevel, message: string, data?: unknown) {
  if (level <= currentLogLevel) {
    const levelName = LogLevel[level];
    const logData = data ? ` ${JSON.stringify(data)}` : "";
    console.log(`[${levelName}] ${message}${logData}`);
  }
}

// =============================================
// EXPO PUSH NOTIFICATION FUNCTIONS
// =============================================

function isValidExpoPushToken(token: string): boolean {
  // Expo push tokens start with ExponentPushToken[...] or ExpoPushToken[...]
  return /^Expo(nent)?PushToken\[.+\]$/.test(token);
}

async function sendExpoPushNotification(
  message: ExpoPushMessage,
  attempt = 1
): Promise<{ success: boolean; error?: string }> {
  try {
    log(LogLevel.INFO, `Sending Expo push notification (attempt ${attempt}/${MAX_RETRIES})`, {
      to: message.to,
      title: message.title,
    });

    const response = await fetch(EXPO_PUSH_API, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify([message]),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log(LogLevel.ERROR, `Expo API returned ${response.status}`, { error: errorText });
      
      // Retry on server errors (5xx) or rate limiting (429)
      if ((response.status >= 500 || response.status === 429) && attempt < MAX_RETRIES) {
        log(LogLevel.WARN, `Retrying after ${RETRY_DELAY_MS}ms delay...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        return sendExpoPushNotification(message, attempt + 1);
      }

      return {
        success: false,
        error: `Expo API error: ${response.status} - ${errorText}`,
      };
    }

    const result: ExpoPushResponse = await response.json();
    log(LogLevel.DEBUG, "Expo API response", result);

    // Check if the push ticket indicates success
    if (result.data && result.data.length > 0) {
      const ticket = result.data[0];
      
      if (ticket.status === "error") {
        log(LogLevel.ERROR, "Expo push ticket error", ticket);
        return {
          success: false,
          error: `Push ticket error: ${ticket.message || 'Unknown error'}`,
        };
      }

      if (ticket.status === "ok") {
        log(LogLevel.INFO, "Push notification sent successfully", { id: ticket.id });
        return { success: true };
      }
    }

    return {
      success: false,
      error: "Unexpected Expo API response format",
    };

  } catch (error) {
    log(LogLevel.ERROR, "Exception while sending push notification", { error: error.message });
    
    // Retry on network errors
    if (attempt < MAX_RETRIES) {
      log(LogLevel.WARN, `Retrying after ${RETRY_DELAY_MS}ms delay...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      return sendExpoPushNotification(message, attempt + 1);
    }

    return {
      success: false,
      error: `Failed after ${MAX_RETRIES} attempts: ${error.message}`,
    };
  }
}

// =============================================
// DATABASE FUNCTIONS
// =============================================

async function fetchRequestDetails(
  supabase: ReturnType<typeof createClient>,
  requestId: string
): Promise<RequestDetails | null> {
  try {
    log(LogLevel.INFO, "Fetching request details", { request_id: requestId });

    const { data, error } = await supabase
      .from("requests")
      .select(`
        id,
        buyer_id,
        property_id,
        seller_id,
        message,
        buyer:profiles!requests_buyer_id_fkey(
          full_name,
          phone
        ),
        property:properties(
          title
        ),
        seller:profiles!requests_seller_id_fkey(
          expo_push_token
        )
      `)
      .eq("id", requestId)
      .maybeSingle();

    if (error) {
      log(LogLevel.ERROR, "Database error fetching request", { error });
      return null;
    }

    if (!data) {
      log(LogLevel.WARN, "Request not found", { request_id: requestId });
      return null;
    }

    // Type assertion for the joined data
    const requestData = data as unknown as {
      id: string;
      buyer_id: string;
      property_id: string;
      seller_id: string;
      message: string | null;
      buyer: { full_name: string; phone: string | null };
      property: { title: string };
      seller: { expo_push_token: string | null };
    };

    log(LogLevel.DEBUG, "Request details fetched", requestData);

    return {
      id: requestData.id,
      buyer_id: requestData.buyer_id,
      property_id: requestData.property_id,
      seller_id: requestData.seller_id,
      message: requestData.message,
      buyer_name: requestData.buyer.full_name,
      buyer_phone: requestData.buyer.phone,
      property_title: requestData.property.title,
      seller_expo_token: requestData.seller.expo_push_token,
    };

  } catch (error) {
    log(LogLevel.ERROR, "Exception fetching request details", { error: error.message });
    return null;
  }
}

// =============================================
// MAIN HANDLER
// =============================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Only accept POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const payload: RequestPayload = await req.json();
    const { request_id } = payload;

    if (!request_id) {
      log(LogLevel.WARN, "Missing request_id in payload");
      return new Response(
        JSON.stringify({ success: false, error: "request_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    log(LogLevel.INFO, "Processing push notification request", { request_id });

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      log(LogLevel.ERROR, "Missing required environment variables");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch request details
    const requestDetails = await fetchRequestDetails(supabase, request_id);

    if (!requestDetails) {
      return new Response(
        JSON.stringify({ success: false, error: "Request not found or database error" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if seller has a push token
    if (!requestDetails.seller_expo_token) {
      log(LogLevel.WARN, "Seller has no Expo push token registered", {
        seller_id: requestDetails.seller_id,
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Seller has no push token registered",
          warning: "Notification not sent - seller needs to enable notifications",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate Expo push token format
    if (!isValidExpoPushToken(requestDetails.seller_expo_token)) {
      log(LogLevel.ERROR, "Invalid Expo push token format", {
        token: requestDetails.seller_expo_token,
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid Expo push token format",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Construct push notification message
    const deepLink = `myapp://seller/requests/${request_id}`;
    const pushMessage: ExpoPushMessage = {
      to: requestDetails.seller_expo_token,
      sound: "default",
      title: `New request for ${requestDetails.property_title}`,
      body: `${requestDetails.buyer_name} is interested in your property${requestDetails.message ? ': "' + requestDetails.message.substring(0, 100) + '"' : ''}`,
      data: {
        request_id: requestDetails.id,
        property_id: requestDetails.property_id,
        url: deepLink,
      },
    };

    // Send push notification
    const result = await sendExpoPushNotification(pushMessage);

    if (result.success) {
      log(LogLevel.INFO, "Push notification sent successfully", { request_id });
      return new Response(
        JSON.stringify({
          success: true,
          message: "Push notification sent",
          request_id,
          deep_link: deepLink,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      log(LogLevel.ERROR, "Failed to send push notification", {
        request_id,
        error: result.error,
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          request_id,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

  } catch (error) {
    log(LogLevel.ERROR, "Unhandled exception in edge function", {
      error: error.message,
      stack: error.stack,
    });
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});