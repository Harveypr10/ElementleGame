-- Migration: Create find_user_by_identity function
-- This function queries auth.identities to find users by their social provider identity
-- Used by link-social-identity Edge Function to detect existing users who signed up
-- before linked_identities table was populated

CREATE OR REPLACE FUNCTION find_user_by_identity(
    p_provider TEXT,
    p_provider_id TEXT
)
RETURNS TABLE(user_id UUID)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = auth, public
AS $$
    SELECT id as user_id
    FROM auth.identities
    WHERE provider = p_provider
    AND provider_id = p_provider_id;
$$;

-- Grant execute to service_role (used by Edge Functions)
GRANT EXECUTE ON FUNCTION find_user_by_identity(TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION find_user_by_identity IS 
'Finds a user by their social identity provider and provider_id (sub claim). 
Used to detect existing Apple/Google sign-in accounts that may not be in linked_identities table.';
