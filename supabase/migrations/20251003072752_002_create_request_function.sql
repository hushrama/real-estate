/*
  # Create Request Function with Atomic Locking

  ## Overview
  Implements the `create_request` function that handles buyer requests for properties
  with proper concurrency control and business rule enforcement.

  ## Function: create_request(p_buyer uuid, p_property uuid, p_message text)

  ### Business Rules Enforced:
  1. **Property Availability**: Property must have status = 'available'
  2. **Single Pending Request**: Buyer can only have ONE pending request at a time
  3. **Atomicity**: Uses SELECT...FOR UPDATE to prevent race conditions
  4. **Status Transition**: Changes property status from 'available' → 'requested'

  ### Concurrency Control:
  - Uses `SELECT...FOR UPDATE` on properties table to acquire row-level lock
  - Prevents multiple buyers from simultaneously requesting the same property
  - Prevents a single buyer from creating multiple pending requests

  ### Error Handling:
  - **Property not available**: Raises exception with SQLSTATE 'P0001'
  - **Unique constraint violation**: Catches SQLSTATE '23505' and raises user-friendly error
  - Returns the new request ID on success

  ### Usage Example:
  ```sql
  SELECT create_request(
    '550e8400-e29b-41d4-a716-446655440000'::uuid,  -- buyer_id
    '660e8400-e29b-41d4-a716-446655440001'::uuid,  -- property_id
    'I am interested in viewing this property'       -- message
  );
  ```

  ## Important Notes:
  - This function MUST be used instead of direct INSERT into requests table
  - The partial unique index on requests(buyer_id) WHERE status='pending' works
    in conjunction with this function to enforce the single pending request rule
  - The function is marked as SECURITY DEFINER to ensure proper execution context
*/

-- =============================================
-- CREATE REQUEST FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION create_request(
  p_buyer uuid,
  p_property uuid,
  p_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property_status property_status;
  v_seller_id uuid;
  v_request_id uuid;
BEGIN
  -- Step 1: Lock the property row and check availability
  -- FOR UPDATE ensures no other transaction can modify this row until we commit
  SELECT status, seller_id
  INTO v_property_status, v_seller_id
  FROM properties
  WHERE id = p_property
  FOR UPDATE;

  -- Step 2: Verify property exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found'
      USING ERRCODE = 'P0002';
  END IF;

  -- Step 3: Verify property is available
  IF v_property_status != 'available' THEN
    RAISE EXCEPTION 'Property is not available (current status: %)', v_property_status
      USING ERRCODE = 'P0001';
  END IF;

  -- Step 4: Verify buyer is not the seller
  IF v_seller_id = p_buyer THEN
    RAISE EXCEPTION 'Sellers cannot request their own properties'
      USING ERRCODE = 'P0003';
  END IF;

  -- Step 5: Attempt to insert the request
  -- The partial unique index will catch duplicate pending requests
  BEGIN
    INSERT INTO requests (buyer_id, property_id, seller_id, message, status)
    VALUES (p_buyer, p_property, v_seller_id, p_message, 'pending')
    RETURNING id INTO v_request_id;

  EXCEPTION
    WHEN unique_violation THEN
      -- SQLSTATE 23505: Unique constraint violation
      -- This catches the partial unique index on requests(buyer_id) WHERE status='pending'
      RAISE EXCEPTION 'Buyer has an active pending request. Please wait for the current request to be processed.'
        USING ERRCODE = '23505';
  END;

  -- Step 6: Update property status to 'requested'
  UPDATE properties
  SET status = 'requested'
  WHERE id = p_property;

  -- Step 7: Log the action in property history
  INSERT INTO property_history (property_id, user_id, action, old_values, new_values)
  VALUES (
    p_property,
    p_buyer,
    'request_created',
    jsonb_build_object('status', 'available'),
    jsonb_build_object('status', 'requested', 'request_id', v_request_id)
  );

  -- Step 8: Return the new request ID
  RETURN v_request_id;
END;
$$;

-- =============================================
-- HELPER FUNCTIONS FOR REQUEST MANAGEMENT
-- =============================================

-- Function to cancel a request (buyer initiated)
CREATE OR REPLACE FUNCTION cancel_request(p_request_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_buyer_id uuid;
  v_property_id uuid;
  v_status request_status;
BEGIN
  -- Lock and fetch the request
  SELECT buyer_id, property_id, status
  INTO v_buyer_id, v_property_id, v_status
  FROM requests
  WHERE id = p_request_id
  FOR UPDATE;

  -- Verify request exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found'
      USING ERRCODE = 'P0002';
  END IF;

  -- Verify user is the buyer
  IF v_buyer_id != p_user_id THEN
    RAISE EXCEPTION 'Only the buyer can cancel their request'
      USING ERRCODE = 'P0004';
  END IF;

  -- Verify request is still pending
  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Only pending requests can be cancelled (current status: %)', v_status
      USING ERRCODE = 'P0001';
  END IF;

  -- Update request status
  UPDATE requests
  SET status = 'cancelled'
  WHERE id = p_request_id;

  -- Revert property status back to available
  UPDATE properties
  SET status = 'available'
  WHERE id = v_property_id;

  RETURN true;
END;
$$;

-- Function to respond to a request (seller initiated)
CREATE OR REPLACE FUNCTION respond_to_request(
  p_request_id uuid,
  p_user_id uuid,
  p_response request_status  -- 'accepted' or 'declined'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seller_id uuid;
  v_property_id uuid;
  v_status request_status;
BEGIN
  -- Validate response
  IF p_response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Invalid response. Must be accepted or declined'
      USING ERRCODE = 'P0005';
  END IF;

  -- Lock and fetch the request
  SELECT seller_id, property_id, status
  INTO v_seller_id, v_property_id, v_status
  FROM requests
  WHERE id = p_request_id
  FOR UPDATE;

  -- Verify request exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found'
      USING ERRCODE = 'P0002';
  END IF;

  -- Verify user is the seller
  IF v_seller_id != p_user_id THEN
    RAISE EXCEPTION 'Only the seller can respond to this request'
      USING ERRCODE = 'P0004';
  END IF;

  -- Verify request is still pending
  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Only pending requests can be responded to (current status: %)', v_status
      USING ERRCODE = 'P0001';
  END IF;

  -- Update request status
  UPDATE requests
  SET status = p_response
  WHERE id = p_request_id;

  -- Update property status based on response
  IF p_response = 'accepted' THEN
    -- Property moves to sold (or could be a different status based on your workflow)
    UPDATE properties
    SET status = 'sold'
    WHERE id = v_property_id;
  ELSIF p_response = 'declined' THEN
    -- Property goes back to available
    UPDATE properties
    SET status = 'available'
    WHERE id = v_property_id;
  END IF;

  RETURN true;
END;
$$;