-- Create a function to delete an identity from auth.identities
-- This runs with SECURITY DEFINER to access the auth schema
-- Should only be callable by service role (or from Edge Functions)

CREATE OR REPLACE FUNCTION public.delete_user_identity(
    target_user_id UUID,
    target_provider TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete the identity for the given user and provider
    DELETE FROM auth.identities
    WHERE user_id = target_user_id
    AND provider = target_provider;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log what happened
    RAISE NOTICE 'Deleted % identity rows for user % provider %', 
        deleted_count, target_user_id, target_provider;
    
    RETURN deleted_count > 0;
END;
$$;

-- Revoke public access, only allow authenticated/service role
REVOKE ALL ON FUNCTION public.delete_user_identity(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_identity(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_identity(UUID, TEXT) TO service_role;

-- Add a comment explaining the function
COMMENT ON FUNCTION public.delete_user_identity(UUID, TEXT) IS 
'Deletes an identity from auth.identities table. Requires SECURITY DEFINER to access auth schema. Should be called from Edge Functions with service role key.';
