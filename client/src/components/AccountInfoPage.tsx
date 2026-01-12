import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { InlineHelp } from "@/components/ui/inline-help";
import { PostcodeAutocomplete } from "@/components/PostcodeAutocomplete";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, Key, Mail, Link2, Check, Plus, Loader2 } from "lucide-react";
import { SiGoogle, SiApple } from "react-icons/si";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { useSupabase } from "@/lib/SupabaseProvider";
import { useSpinnerWithTimeout } from "@/lib/SpinnerProvider";
import { queryClient } from "@/lib/queryClient";
import { validatePassword, getPasswordRequirementsText } from "@/lib/passwordValidation";
import { OTPVerificationScreen } from "./OTPVerificationScreen";
import { GeneratingQuestionsScreen } from "./GeneratingQuestionsScreen";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Region, UserProfile } from "@shared/schema";
import { useAdBannerActive } from "@/components/AdBanner";
import { readLocal, writeLocal, CACHE_KEYS } from "@/lib/localCache";

interface AccountInfoPageProps {
  onBack: () => void;
}

export default function AccountInfoPage({ onBack }: AccountInfoPageProps) {
  const supabase = useSupabase();
  const { user } = useAuth();
  const { profile, updateProfile, isLoading: profileLoading } = useProfile();
  const { isPro } = useSubscription();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const adBannerActive = useAdBannerActive();
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [originalEmail, setOriginalEmail] = useState("");
  const [originalPostcode, setOriginalPostcode] = useState("");
  const [originalRegion, setOriginalRegion] = useState("");
  const [showRegionConfirm, setShowRegionConfirm] = useState(false);
  const [pendingRegion, setPendingRegion] = useState<string | null>(null);
  const [showGeneratingQuestions, setShowGeneratingQuestions] = useState(false);
  const [showRestrictionPopup, setShowRestrictionPopup] = useState(false);
  const [restrictionMessage, setRestrictionMessage] = useState("");
  const [showPostcodeInvalidDialog, setShowPostcodeInvalidDialog] = useState(false);
  
  // Track if spinner was actually shown (not just managed)
  const spinnerShownRef = useRef(false);
  
  // Check if data is already in cache on mount - check React Query cache first, then localStorage
  const rqCachedProfile = qc.getQueryData<UserProfile>(['/api/auth/profile']);
  const rqCachedRegions = qc.getQueryData<Region[]>(['/api/regions']);
  
  // Fallback to localStorage cache if React Query cache is empty
  const localCachedProfile = !rqCachedProfile ? readLocal<UserProfile>(CACHE_KEYS.PROFILE) : null;
  const localCachedRegions = !rqCachedRegions ? readLocal<Region[]>(CACHE_KEYS.REGIONS) : null;
  
  // Use either React Query cache or localStorage cache
  const cachedProfile = rqCachedProfile || localCachedProfile;
  const cachedRegions = rqCachedRegions || localCachedRegions;
  
  // Helper functions to validate cached data - defined inline to avoid hook dependency issues
  const isValidProfile = (p: UserProfile | null | undefined): boolean => {
    if (!p) return false;
    return !!(p.id || p.email);
  };
  const isValidRegions = (r: Region[] | null | undefined): boolean => {
    if (!r) return false;
    return Array.isArray(r) && r.length > 0;
  };
  
  // hasCachedData only true if data is actually valid/usable
  const hasCachedData = isValidProfile(cachedProfile) && isValidRegions(cachedRegions);
  
  // Fetch available regions
  const { data: regions, isLoading: regionsLoading, refetch: refetchRegions } = useQuery<Region[]>({
    queryKey: ['/api/regions'],
  });
  
  // Callbacks for spinner timeout handling
  const handleRetry = useCallback(() => {
    console.log('[AccountInfoPage] Spinner timeout - triggering retry');
    qc.invalidateQueries({ queryKey: ['/api/auth/profile'] });
    refetchRegions?.();
  }, [qc, refetchRegions]);
  
  const handleTimeout = useCallback(() => {
    console.log('[AccountInfoPage] Spinner timeout - failed to load');
    toast({
      title: 'Failed to load',
      description: 'Please try again in a bit.',
      variant: 'destructive',
    });
    onBack();
  }, [toast, onBack]);
  
  // Use spinner with timeout for automatic retry and failure handling
  const spinner = useSpinnerWithTimeout({
    retryDelayMs: 4000,
    timeoutMs: 8000,
    onRetry: handleRetry,
    onTimeout: handleTimeout,
  });
  
  // Helper to check if profile has meaningful data (not just truthy)
  const hasValidProfileData = useCallback((p: UserProfile | null | undefined): boolean => {
    if (!p) return false;
    // Profile must have at least an ID or email to be considered valid
    return !!(p.id || p.email);
  }, []);
  
  // Helper to check if regions has meaningful data
  const hasValidRegionsData = useCallback((r: Region[] | null | undefined): boolean => {
    if (!r) return false;
    return Array.isArray(r) && r.length > 0;
  }, []);
  
  // Manage spinner: only show if data is NOT already cached with valid content
  useEffect(() => {
    // Check if cached data is actually valid/usable
    const cachedProfileValid = hasValidProfileData(cachedProfile);
    const cachedRegionsValid = hasValidRegionsData(cachedRegions);
    const hasValidCachedData = cachedProfileValid && cachedRegionsValid;
    
    // If we already have valid cached data, never show spinner
    if (hasValidCachedData) {
      console.log('[AccountInfoPage] Valid cached data found, skipping spinner');
      return;
    }
    
    // Check if fresh data is valid
    const profileValid = hasValidProfileData(profile);
    const regionsValid = hasValidRegionsData(regions);
    const isDataReady = profileValid && regionsValid;
    const isDataLoading = profileLoading || regionsLoading;
    
    // Start spinner if loading and no valid data yet
    if (!isDataReady && !spinnerShownRef.current) {
      console.log('[AccountInfoPage] Showing spinner with timeout - waiting for valid profile/regions data');
      spinner.start(0);
      spinnerShownRef.current = true;
    }
    
    // Complete spinner when valid data is ready
    if (isDataReady && spinnerShownRef.current) {
      console.log('[AccountInfoPage] Valid data loaded - completing spinner');
      spinner.complete();
      spinnerShownRef.current = false;
    }
    
    // Cleanup on unmount - only cancel if we actually showed the spinner
    return () => {
      if (spinnerShownRef.current) {
        spinner.cancel();
        spinnerShownRef.current = false;
      }
    };
  }, [profileLoading, regionsLoading, profile, regions, spinner, cachedProfile, cachedRegions, hasValidProfileData, hasValidRegionsData]);

  // Initialize profile data from cache immediately if available
  const initialProfile = cachedProfile || profile;
  const initialRegions = cachedRegions || regions;
  
  const [profileData, setProfileData] = useState(() => ({
    firstName: initialProfile?.firstName || "",
    lastName: initialProfile?.lastName || "",
    email: initialProfile?.email || "",
    region: initialProfile?.region || (initialRegions && initialRegions.length > 0 ? initialRegions[0].code : ""),
    postcode: initialProfile?.postcode || "",
  }));
  
  // Track if we've already initialized from profile
  const initializedRef = useRef(!!initialProfile);

  // Update profile data when fresh data loads (but only if not already initialized from cache)
  useEffect(() => {
    if (profile && !initializedRef.current) {
      setProfileData({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        email: profile.email || "",
        region: profile.region || (regions && regions.length > 0 ? regions[0].code : ""),
        postcode: profile.postcode || "",
      });
      setOriginalEmail(profile.email || "");
      setOriginalPostcode(profile.postcode || "");
      setOriginalRegion(profile.region || "");
      initializedRef.current = true;
    }
  }, [profile, regions]);
  
  // Set original values from initial data
  useEffect(() => {
    if (initialProfile && !originalEmail) {
      setOriginalEmail(initialProfile.email || "");
    }
    if (initialProfile && !originalPostcode) {
      setOriginalPostcode(initialProfile.postcode || "");
    }
  }, [initialProfile, originalEmail, originalPostcode]);

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  
  // Track if user has a password (authenticated with password vs magic link only)
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  
  // Connected accounts state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isAppleConnected, setIsAppleConnected] = useState(false);
  const [unlinkingGoogle, setUnlinkingGoogle] = useState(false);
  const [unlinkingApple, setUnlinkingApple] = useState(false);
  const [googleIdentity, setGoogleIdentity] = useState<any>(null);
  const [appleIdentity, setAppleIdentity] = useState<any>(null);
  const [magicLinkEnabled, setMagicLinkEnabled] = useState(true);
  const [togglingMagicLink, setTogglingMagicLink] = useState(false);
  
  // Initialize magic link enabled state from Supabase (column not in Drizzle schema)
  useEffect(() => {
    const fetchMagicLinkSetting = async () => {
      if (!user?.id) return;
      try {
        const session = await supabase.auth.getSession();
        if (session.data.session) {
          const response = await fetch(`/api/auth/profile/magic-link-status`, {
            headers: {
              'Authorization': `Bearer ${session.data.session.access_token}`,
            },
          });
          if (response.ok) {
            const data = await response.json();
            setMagicLinkEnabled(data.enabled !== false);
          }
        }
      } catch (e) {
        // Default to enabled if we can't fetch
        console.log('[AccountInfoPage] Could not fetch magic link status, defaulting to enabled');
      }
    };
    fetchMagicLinkSetting();
  }, [user?.id, supabase]);
  
  // Check if user has a password - prefer profile.passwordCreated, fallback to AMR check
  useEffect(() => {
    const checkHasPassword = async () => {
      try {
        // First check if profile has passwordCreated field
        if (profile?.passwordCreated !== undefined && profile.passwordCreated !== null) {
          setHasPassword(profile.passwordCreated);
          return;
        }
        
        // Fallback: Check AMR (Authentication Methods Reference) from session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const amr = (session as any).user?.amr || [];
          const hasPasswordAuth = amr.some((method: any) => method.method === 'password');
          setHasPassword(hasPasswordAuth);
        } else {
          setHasPassword(false);
        }
      } catch (error) {
        console.error('Error checking password status:', error);
        setHasPassword(false);
      }
    };
    checkHasPassword();
  }, [supabase, profile?.passwordCreated]);
  
  // Check if Google/Apple is connected - based on profile.googleLinked/appleLinked, not Supabase identity
  // This allows "unlinking" without revoking OAuth, so re-linking doesn't require re-authorization
  useEffect(() => {
    const checkOAuthConnections = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Find Google identity in Supabase (for re-linking without re-auth)
          const googleId = user.identities?.find(
            (identity) => identity.provider === 'google'
          );
          const providers = user.app_metadata?.providers || [];
          const hasGoogleProvider = providers.includes('google') || 
                                   user.app_metadata?.provider === 'google';
          
          setGoogleIdentity(googleId || null);
          
          // Find Apple identity in Supabase
          const appleId = user.identities?.find(
            (identity) => identity.provider === 'apple'
          );
          const hasAppleProvider = providers.includes('apple') || 
                                  user.app_metadata?.provider === 'apple';
          
          setAppleIdentity(appleId || null);
          
          // UI "connected" state is based on profile.googleLinked/appleLinked
          // Not on whether identity exists in Supabase
          setIsGoogleConnected(profile?.googleLinked === true);
          setIsAppleConnected(profile?.appleLinked === true);
          
          // Sync database if we just authorized OAuth (first time or after redirect from linkIdentity)
          // Only sync if identity exists in Supabase but profile says NOT linked
          const googleHasIdentity = !!googleId || hasGoogleProvider;
          const appleHasIdentity = !!appleId || hasAppleProvider;
          
          const session = await supabase.auth.getSession();
          if (session.data.session) {
            const accessToken = session.data.session.access_token;
            
            // If Google identity exists but never tracked (null) in profile, set linked=true
            // Don't sync if googleLinked=false (user explicitly unlinked)
            if (googleHasIdentity && profile?.googleLinked === null) {
              console.log('[AccountInfoPage] Syncing Google linked status to database (first auth)');
              fetch('/api/auth/profile/oauth-linked', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ provider: 'google', linked: true }),
              }).then(() => {
                queryClient.invalidateQueries({ queryKey: ['/api/auth/profile'] });
              }).catch(err => console.error('Failed to sync Google linked status:', err));
            }
            
            // Same for Apple
            if (appleHasIdentity && profile?.appleLinked === null) {
              console.log('[AccountInfoPage] Syncing Apple linked status to database (first auth)');
              fetch('/api/auth/profile/oauth-linked', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ provider: 'apple', linked: true }),
              }).then(() => {
                queryClient.invalidateQueries({ queryKey: ['/api/auth/profile'] });
              }).catch(err => console.error('Failed to sync Apple linked status:', err));
            }
          }
        }
      } catch (error) {
        console.error('Error checking OAuth connections:', error);
        setIsGoogleConnected(false);
        setIsAppleConnected(false);
      }
    };
    checkOAuthConnections();
  }, [supabase, profile?.googleLinked, profile?.appleLinked]);

  const handleRegionChange = (newRegion: string) => {
    // Only show confirmation if region actually changed from profile's current region
    if (profile && newRegion !== profile.region) {
      setPendingRegion(newRegion);
      setShowRegionConfirm(true);
    } else {
      // Just update the local state without showing dialog
      setProfileData({ ...profileData, region: newRegion });
    }
  };

  const handleConfirmRegionChange = async () => {
    if (!pendingRegion) return;

    setLoading(true);
    setShowRegionConfirm(false);

    try {
      // Call API directly to check for restriction response
      const session = (await supabase.auth.getSession()).data.session;
      const accessToken = session?.access_token;
      
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          region: pendingRegion,
        }),
      });
      
      const data = await response.json();
      
      // Check for restriction response
      if (data._restrictionBlocked) {
        // Restriction triggered - region change was blocked
        setRestrictionMessage(data._restrictionMessage || "You can only update your region once every few days.");
        setShowRestrictionPopup(true);
        setPendingRegion(null);
        return;
      }
      
      if (!response.ok) {
        // Check for cooldown error
        if (data.code === 'LOCATION_COOLDOWN') {
          setRestrictionMessage(data.error || "You can only update your region once every few days.");
          setShowRestrictionPopup(true);
          setPendingRegion(null);
          return;
        }
        throw new Error(data.error || 'Failed to update region');
      }
      
      // Update caches
      qc.setQueryData(["/api/auth/profile"], data);
      writeLocal(CACHE_KEYS.PROFILE, data);

      setProfileData({ ...profileData, region: pendingRegion });
      setOriginalRegion(pendingRegion);
      setPendingRegion(null);

      toast({
        title: "Region updated!",
        description: "Your region preference has been saved.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update region",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRegionChange = () => {
    setPendingRegion(null);
    setShowRegionConfirm(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailChanged = profileData.email !== originalEmail;
    const postcodeChanged = profileData.postcode !== originalPostcode;
    
    // If postcode is changing to a non-empty value, validate it first
    if (postcodeChanged && profileData.postcode && profileData.postcode.trim()) {
      try {
        const validateResponse = await fetch(`/api/postcodes/validate?postcode=${encodeURIComponent(profileData.postcode.trim())}`);
        const validateResult = await validateResponse.json();
        
        if (!validateResult.valid) {
          // Postcode not supported - show dialog and revert to original
          setShowPostcodeInvalidDialog(true);
          setProfileData(prev => ({ ...prev, postcode: originalPostcode }));
          return;
        }
      } catch (error) {
        console.error("[AccountInfo] Postcode validation error:", error);
        // On validation error, show the dialog to be safe
        setShowPostcodeInvalidDialog(true);
        setProfileData(prev => ({ ...prev, postcode: originalPostcode }));
        return;
      }
    }
    
    setLoading(true);

    try {

      if (emailChanged) {
        // Initiate email change - Supabase will send OTP to new email
        const { error } = await supabase.auth.updateUser({
          email: profileData.email,
        });

        if (error) throw error;

        // Show OTP verification screen
        setShowOTPVerification(true);
        toast({
          title: "Verification code sent!",
          description: `Please check ${profileData.email} for your verification code`,
        });
      } else {
        // No email change, just update name fields
        const { error } = await supabase.auth.updateUser({
          data: {
            first_name: profileData.firstName,
            last_name: profileData.lastName,
          },
        });

        if (error) throw error;

        // Update user profile in database via API
        const session = (await supabase.auth.getSession()).data.session;
        const accessToken = session?.access_token;
        
        const response = await fetch('/api/auth/profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            firstName: profileData.firstName,
            lastName: profileData.lastName,
            email: profileData.email,
            postcode: profileData.postcode || null,
          }),
        });

        const responseData = await response.json().catch(() => ({}));

        // Check for restriction response (postcode change was blocked but name/email saved)
        if (responseData._restrictionBlocked) {
          // Name/email changes were saved, but postcode change was blocked
          // Reset postcode to original since it wasn't changed
          setProfileData({ ...profileData, postcode: originalPostcode });
          
          // Update caches with the partial update (excluding blocked postcode change)
          qc.setQueryData(["/api/auth/profile"], responseData);
          writeLocal(CACHE_KEYS.PROFILE, responseData);
          
          // Show restriction popup
          setRestrictionMessage(responseData._restrictionMessage || "You can only update your postcode once every few days.");
          setShowRestrictionPopup(true);
          
          // Still show success for name/email if they were changed
          if (profileData.firstName !== originalEmail || profileData.lastName !== originalEmail) {
            toast({
              title: "Profile partially updated",
              description: "Name changes saved, but postcode change was blocked.",
            });
          }
          return;
        }

        if (!response.ok) {
          // Check for cooldown error when only postcode was submitted
          if (responseData.code === 'LOCATION_COOLDOWN') {
            setRestrictionMessage(responseData.error || "You can only update your postcode once every few days.");
            setShowRestrictionPopup(true);
            setProfileData({ ...profileData, postcode: originalPostcode });
            return;
          }
          throw new Error(responseData.error || 'Failed to update profile in database');
        }

        // Get the updated profile from response and update caches immediately
        const updatedProfile = responseData;
        
        // Update React Query cache immediately with new data
        qc.setQueryData(["/api/auth/profile"], updatedProfile);
        
        // Update localStorage cache immediately
        writeLocal(CACHE_KEYS.PROFILE, updatedProfile);

        // If postcode changed, call reset-and-reallocate-user then show GeneratingQuestionsScreen
        if (postcodeChanged && user?.id && profileData.postcode) {
          console.log('[AccountInfoPage] Postcode changed - calling reset-and-reallocate-user');
          
          // Validate that we have an access token
          if (!accessToken) {
            throw new Error("No access token found");
          }
          
          // Call the reset-and-reallocate-user Edge Function
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (supabase as any).supabaseUrl;
          if (!supabaseUrl) {
            console.warn('[AccountInfoPage] Supabase URL not available; skipping reset-and-reallocate-user');
          } else {
            const functionBaseUrl = supabaseUrl.replace('.supabase.co', '.functions.supabase.co');
            console.log('[AccountInfoPage] Function base URL:', functionBaseUrl);
            
            try {
              const resetPayload = { user_id: user.id };
              const resetResponse = await fetch(`${functionBaseUrl}/reset-and-reallocate-user`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify(resetPayload),
              });
              
              const resetBody = await resetResponse.text();
              console.log('[AccountInfoPage] reset-and-reallocate-user status:', resetResponse.status, resetBody);
              
              if (!resetResponse.ok) {
                throw new Error(`reset-and-reallocate-user returned error: ${resetResponse.status}`);
              }
            } catch (err) {
              console.error('[AccountInfoPage] reset-and-reallocate-user failed:', err);
              throw err;
            }
          }
          
          // Update original postcode reference
          setOriginalPostcode(profileData.postcode);
          
          // Show GeneratingQuestionsScreen to repopulate locations and allocate questions
          setShowGeneratingQuestions(true);
          return; // Don't show toast - GeneratingQuestionsScreen will handle completion
        }

        toast({
          title: "Profile updated!",
          description: "Your profile information has been saved.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOTPVerified = async () => {
    // After OTP verification, email is already updated in Supabase Auth
    // Just need to update the profile in our database
    setLoading(true);
    try {
      // Update user profile in database with new email
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          email: profileData.email,
          postcode: profileData.postcode || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update profile in database');
      }

      // Get the updated profile from response and update caches immediately
      const updatedProfile = await response.json();
      
      // Update React Query cache immediately with new data
      qc.setQueryData(["/api/auth/profile"], updatedProfile);
      
      // Update localStorage cache immediately
      writeLocal(CACHE_KEYS.PROFILE, updatedProfile);

      setShowOTPVerification(false);
      setOriginalEmail(profileData.email); // Update the original email reference
      toast({
        title: "Email updated!",
        description: "Your email address has been successfully changed.",
      });
    } catch (error: any) {
      toast({
        title: "Error updating email",
        description: error.message || "Failed to update email",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEmailChange = () => {
    // Reset email to original value
    setProfileData({
      ...profileData,
      email: originalEmail,
    });
    setShowOTPVerification(false);
    toast({
      title: "Email change cancelled",
      description: "Your email has not been changed",
    });
  };

  // Toggle magic link login enabled/disabled
  const handleToggleMagicLink = async (enabled: boolean) => {
    if (togglingMagicLink) return;
    
    // Check if user has another way to log in before disabling
    if (!enabled && !hasPassword && !isGoogleConnected && !isAppleConnected) {
      toast({
        title: "Cannot disable magic link",
        description: "You need at least one login method. Please set up a password or connect a social account first.",
        variant: "destructive",
      });
      return;
    }
    
    setTogglingMagicLink(true);
    
    try {
      const session = await supabase.auth.getSession();
      if (session.data.session) {
        const response = await fetch('/api/auth/profile/magic-link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session.access_token}`,
          },
          body: JSON.stringify({ enabled }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to update magic link setting');
        }
        
        setMagicLinkEnabled(enabled);
        
        // Invalidate profile cache
        queryClient.invalidateQueries({ queryKey: ['/api/auth/profile'] });
        
        toast({
          title: enabled ? "Magic link enabled" : "Magic link disabled",
          description: enabled 
            ? "You can now sign in with email links" 
            : "Magic link sign-in has been disabled",
        });
      }
    } catch (error: any) {
      toast({
        title: "Failed to update setting",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setTogglingMagicLink(false);
    }
  };

  // Unlink Google account - just updates database, keeps Supabase identity so re-auth isn't needed
  const handleUnlinkGoogle = async () => {
    if (unlinkingGoogle) return;
    
    // Check if user has another way to log in (password or Apple)
    if (!hasPassword && !isAppleConnected) {
      toast({
        title: "Cannot unlink Google",
        description: "You need at least one login method. Please set up a password first.",
        variant: "destructive",
      });
      return;
    }
    
    setUnlinkingGoogle(true);
    
    try {
      // Only update the database - don't revoke from Supabase
      // This allows re-linking without re-authorization
      const session = await supabase.auth.getSession();
      if (session.data.session) {
        const response = await fetch('/api/auth/profile/oauth-linked', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session.access_token}`,
          },
          body: JSON.stringify({ provider: 'google', linked: false }),
        });
        
        if (!response.ok) throw new Error('Failed to update profile');
      }
      
      setIsGoogleConnected(false);
      // Keep googleIdentity set - we still have it in Supabase
      
      // Invalidate profile query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/profile'] });
      
      toast({
        title: "Google disconnected",
        description: "Google sign-in has been disabled for your account.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to unlink Google",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setUnlinkingGoogle(false);
    }
  };

  // Unlink Apple account - just updates database, keeps Supabase identity so re-auth isn't needed
  const handleUnlinkApple = async () => {
    if (unlinkingApple) return;
    
    // Check if user has another way to log in (password or Google)
    if (!hasPassword && !isGoogleConnected) {
      toast({
        title: "Cannot unlink Apple",
        description: "You need at least one login method. Please set up a password first.",
        variant: "destructive",
      });
      return;
    }
    
    setUnlinkingApple(true);
    
    try {
      // Only update the database - don't revoke from Supabase
      // This allows re-linking without re-authorization
      const session = await supabase.auth.getSession();
      if (session.data.session) {
        const response = await fetch('/api/auth/profile/oauth-linked', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session.access_token}`,
          },
          body: JSON.stringify({ provider: 'apple', linked: false }),
        });
        
        if (!response.ok) throw new Error('Failed to update profile');
      }
      
      setIsAppleConnected(false);
      // Keep appleIdentity set - we still have it in Supabase
      
      // Invalidate profile query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/profile'] });
      
      toast({
        title: "Apple disconnected",
        description: "Apple sign-in has been disabled for your account.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to unlink Apple",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setUnlinkingApple(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate new password
    const validation = validatePassword(passwordData.newPassword);
    if (!validation.valid) {
      toast({
        title: "Invalid Password",
        description: validation.errors.join(', '),
        variant: "destructive",
      });
      return;
    }

    // Check passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirmation must match",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // If user has a password, verify current password first
      if (hasPassword) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user?.email || "",
          password: passwordData.currentPassword,
        });

        if (signInError) {
          throw new Error("Current password is incorrect");
        }
      }

      // Update/create password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (updateError) throw updateError;

      // Update hasPassword state since they now have a password
      setHasPassword(true);
      
      // Update passwordCreated in database
      try {
        const session = (await supabase.auth.getSession()).data.session;
        if (session?.access_token) {
          await fetch('/api/auth/profile/password-created', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
          });
          // Invalidate profile cache to reflect the change
          qc.invalidateQueries({ queryKey: ['/api/auth/profile'] });
        }
      } catch (dbError) {
        console.error('Failed to update passwordCreated in database:', dbError);
        // Non-critical error - password was still updated in Supabase Auth
      }
      
      // Hide password section after successful creation
      setShowPasswordSection(false);

      toast({
        title: hasPassword ? "Password changed!" : "Password created!",
        description: hasPassword 
          ? "Your password has been updated successfully."
          : "Your password has been created. You can now log in with email and password.",
      });

      // Clear password fields
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handler for when GeneratingQuestionsScreen completes
  const handleGeneratingQuestionsComplete = () => {
    console.log('[AccountInfoPage] GeneratingQuestionsScreen complete - navigating back');
    setShowGeneratingQuestions(false);
    setLoading(false);
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['/api/user/puzzles'] });
    queryClient.invalidateQueries({ queryKey: ['/api/puzzles'] });
    queryClient.invalidateQueries({ queryKey: ['/api/user/game-attempts/user'] });
    queryClient.invalidateQueries({ queryKey: ['/api/game-attempts/user'] });
    toast({
      title: "Profile updated!",
      description: "Your postcode and puzzles have been updated.",
    });
    onBack(); // Navigate back to GameSelectionPage
  };

  // Show GeneratingQuestionsScreen after postcode change
  if (showGeneratingQuestions && user?.id && profile?.region && profileData.postcode) {
    return (
      <GeneratingQuestionsScreen
        userId={user.id}
        region={profile.region}
        postcode={profileData.postcode}
        onComplete={handleGeneratingQuestionsComplete}
        regenerationType="postcode_change"
        isPro={isPro}
      />
    );
  }

  // Show OTP verification screen for email change
  if (showOTPVerification) {
    return (
      <OTPVerificationScreen
        email={profileData.email}
        type="email_change"
        onVerified={handleOTPVerified}
        onCancel={handleCancelEmailChange}
      />
    );
  }

  return (
    <div className={`min-h-screen flex flex-col p-4 bg-background ${adBannerActive ? 'pb-[50px]' : ''}`}>
      <div className="w-full max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            data-testid="button-back-from-account"
            className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="h-9 w-9 text-gray-700" />
          </button>

          <div className="flex flex-col items-center">
            <h1 className="text-4xl font-bold">Account Info</h1>
          </div>

          {/* Spacer to balance layout */}
          <div className="w-14" />
        </div>
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your name and email</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" data-testid="label-firstname">
                      First Name
                    </Label>
                    <Input
                      id="firstName"
                      data-testid="input-firstname"
                      value={profileData.firstName}
                      onChange={(e) =>
                        setProfileData({ ...profileData, firstName: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" data-testid="label-lastname">
                      Last Name
                    </Label>
                    <Input
                      id="lastName"
                      data-testid="input-lastname"
                      value={profileData.lastName}
                      onChange={(e) =>
                        setProfileData({ ...profileData, lastName: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" data-testid="label-email">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    data-testid="input-email"
                    value={profileData.email}
                    onChange={(e) =>
                      setProfileData({ ...profileData, email: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="postcode" data-testid="label-postcode-account">
                      Postcode
                    </Label>
                    <InlineHelp data-testid="button-postcode-info-account">
                      <p>Your postcode helps us provide local puzzles. Changing this may affect your local puzzle availability.</p>
                    </InlineHelp>
                  </div>
                  <PostcodeAutocomplete
                    value={profileData.postcode}
                    onChange={(value) =>
                      setProfileData({ ...profileData, postcode: value })
                    }
                    placeholder="Enter your postcode"
                    data-testid="input-postcode-account"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="region" data-testid="label-region-account">
                    Region
                  </Label>
                  <Select
                    value={profileData.region}
                    onValueChange={handleRegionChange}
                    disabled={regionsLoading}
                  >
                    <SelectTrigger id="region" data-testid="select-region-account">
                      <SelectValue placeholder={regionsLoading ? "Loading regions..." : "Select your region"} />
                    </SelectTrigger>
                    <SelectContent>
                      {regions?.map((region) => (
                          <SelectItem 
                            key={region.code} 
                            value={region.code} 
                            data-testid={`option-region-${region.code.toLowerCase()}-account`}
                          >
                            {region.name}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  {profile?.postcodeLastChangedAt && (
                    <p className="text-xs text-muted-foreground" data-testid="text-region-last-updated-account">
                      Last updated: {new Date(profile.postcodeLastChangedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                  data-testid="button-update-profile"
                >
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Connected Accounts */}
          <Card>
            <CardHeader>
              <CardTitle>Connected Accounts</CardTitle>
              <CardDescription>Manage your login methods</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Password Login Method */}
              <div className="flex items-center justify-between p-3 rounded-lg border" data-testid="connected-account-password">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Key className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Password</p>
                    <p className="text-sm text-muted-foreground">
                      {hasPassword ? "Password set" : "No password set"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasPassword && (
                    <Check className="w-5 h-5 text-green-500" />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPasswordSection(!showPasswordSection)}
                    data-testid="button-toggle-password-section"
                  >
                    {hasPassword ? "Change" : "Create"}
                  </Button>
                </div>
              </div>
              
              {/* Password Form (collapsible) */}
              {showPasswordSection && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    {hasPassword && (
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword" data-testid="label-current-password">
                          Current Password
                        </Label>
                        <PasswordInput
                          id="currentPassword"
                          data-testid="input-current-password"
                          value={passwordData.currentPassword}
                          onChange={(e) =>
                            setPasswordData({ ...passwordData, currentPassword: e.target.value })
                          }
                          required
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (!user?.email) {
                              toast({
                                title: "Error",
                                description: "No email address found for your account.",
                                variant: "destructive",
                              });
                              return;
                            }
                            setLoading(true);
                            try {
                              const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                                redirectTo: `${window.location.origin}/reset-password`,
                              });
                              if (error) throw error;
                              toast({
                                title: "Email sent!",
                                description: "Check your inbox for a password reset link.",
                              });
                              setShowPasswordSection(false);
                            } catch (err: any) {
                              toast({
                                title: "Error",
                                description: err.message || "Failed to send reset email",
                                variant: "destructive",
                              });
                            } finally {
                              setLoading(false);
                            }
                          }}
                          className="text-sm underline text-blue-600 dark:text-blue-400"
                          data-testid="button-forgot-password-settings"
                        >
                          Forgot your password?
                        </button>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label htmlFor="newPassword" data-testid="label-new-password">
                        {hasPassword ? "New Password" : "Password"}
                      </Label>
                      <PasswordInput
                        id="newPassword"
                        data-testid="input-new-password"
                        value={passwordData.newPassword}
                        onChange={(e) =>
                          setPasswordData({ ...passwordData, newPassword: e.target.value })
                        }
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        {getPasswordRequirementsText()}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" data-testid="label-confirm-password">
                        {hasPassword ? "Confirm New Password" : "Confirm Password"}
                      </Label>
                      <PasswordInput
                        id="confirmPassword"
                        data-testid="input-confirm-password"
                        value={passwordData.confirmPassword}
                        onChange={(e) =>
                          setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowPasswordSection(false);
                          setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
                        }}
                        data-testid="button-cancel-password"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={loading || hasPassword === null}
                        data-testid="button-save-password"
                      >
                        {loading 
                          ? (hasPassword ? "Saving..." : "Creating...") 
                          : (hasPassword ? "Save Password" : "Create Password")}
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* Magic Link Login Method */}
              <div className="flex items-center justify-between p-3 rounded-lg border" data-testid="connected-account-magic-link">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium">Magic Link</p>
                    <p className="text-sm text-muted-foreground">
                      {magicLinkEnabled ? "Sign in with email link enabled" : "Sign in with email link disabled"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {togglingMagicLink ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Switch
                      checked={magicLinkEnabled}
                      onCheckedChange={handleToggleMagicLink}
                      className="data-[state=checked]:bg-blue-500"
                      data-testid="switch-magic-link"
                    />
                  )}
                </div>
              </div>

              {/* Google Login Method */}
              <div className={`flex items-center justify-between p-3 rounded-lg border ${!isGoogleConnected ? 'opacity-80' : ''}`} data-testid="connected-account-google">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                    <SiGoogle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="font-medium">Google</p>
                    <p className="text-sm text-muted-foreground">
                      {isGoogleConnected ? "Connected" : "Not connected"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isGoogleConnected ? (
                    <>
                      <Check className="w-5 h-5 text-green-500" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUnlinkGoogle}
                        disabled={unlinkingGoogle}
                        data-testid="button-unlink-google"
                      >
                        {unlinkingGoogle ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Unlink"
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          // If identity already exists in Supabase (user unlinked previously),
                          // just update the database - no need to re-authorize
                          if (googleIdentity) {
                            const session = await supabase.auth.getSession();
                            if (session.data.session) {
                              const response = await fetch('/api/auth/profile/oauth-linked', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${session.data.session.access_token}`,
                                },
                                body: JSON.stringify({ provider: 'google', linked: true }),
                              });
                              
                              if (response.ok) {
                                setIsGoogleConnected(true);
                                queryClient.invalidateQueries({ queryKey: ['/api/auth/profile'] });
                                toast({
                                  title: "Google connected",
                                  description: "Google sign-in is now enabled for your account.",
                                });
                              } else {
                                throw new Error('Failed to update profile');
                              }
                            }
                          } else {
                            // No identity exists - need to authorize with Google
                            const { error } = await supabase.auth.linkIdentity({
                              provider: "google",
                              options: {
                                redirectTo: window.location.origin,
                              },
                            });
                            if (error) {
                              toast({
                                title: "Error",
                                description: error.message,
                                variant: "destructive",
                              });
                            }
                          }
                        } catch (error: any) {
                          toast({
                            title: "Error",
                            description: error.message || "Failed to connect Google",
                            variant: "destructive",
                          });
                        }
                      }}
                      data-testid="button-connect-google"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Connect
                    </Button>
                  )}
                </div>
              </div>

              {/* Apple Login Method */}
              <div className={`flex items-center justify-between p-3 rounded-lg border ${!isAppleConnected ? 'opacity-60' : ''}`} data-testid="connected-account-apple">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-800/10 dark:bg-gray-200/10 flex items-center justify-center">
                    <SiApple className="w-5 h-5 text-gray-800 dark:text-gray-200" />
                  </div>
                  <div>
                    <p className="font-medium">Apple</p>
                    <p className="text-sm text-muted-foreground">
                      {isAppleConnected ? "Connected" : "Coming soon"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAppleConnected ? (
                    <>
                      <Check className="w-5 h-5 text-green-500" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUnlinkApple}
                        disabled={unlinkingApple}
                        data-testid="button-unlink-apple"
                      >
                        {unlinkingApple ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Unlink"
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      data-testid="button-connect-apple"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
      </div>

      {/* Region Change Confirmation Dialog */}
      <AlertDialog open={showRegionConfirm} onOpenChange={setShowRegionConfirm}>
        <AlertDialogContent data-testid="alert-region-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Change Region?</AlertDialogTitle>
            <AlertDialogDescription>
              Changing your region will change the puzzles you see going forward. Your past game history will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelRegionChange} data-testid="button-cancel-region-change">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRegionChange} data-testid="button-confirm-region-change">
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Location Restriction Popup */}
      <AlertDialog open={showRestrictionPopup} onOpenChange={setShowRestrictionPopup}>
        <AlertDialogContent data-testid="alert-location-restriction">
          <AlertDialogHeader>
            <AlertDialogTitle>Change Not Allowed</AlertDialogTitle>
            <AlertDialogDescription>
              {restrictionMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => setShowRestrictionPopup(false)} 
              data-testid="button-dismiss-restriction"
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Postcode not supported dialog */}
      <AlertDialog open={showPostcodeInvalidDialog} onOpenChange={setShowPostcodeInvalidDialog}>
        <AlertDialogContent data-testid="alert-postcode-invalid">
          <AlertDialogHeader>
            <AlertDialogTitle>Postcode Not Supported</AlertDialogTitle>
            <AlertDialogDescription>
              Unfortunately this postcode is not currently supported for location based questions. Please try another postcode or leave the postcode blank to have Hammie generate your personalised questions for you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => setShowPostcodeInvalidDialog(false)}
              data-testid="button-ok-postcode-invalid"
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
