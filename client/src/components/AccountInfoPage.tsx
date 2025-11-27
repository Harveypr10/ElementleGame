import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { useSupabase } from "@/lib/SupabaseProvider";
import { queryClient } from "@/lib/queryClient";
import { validatePassword, getPasswordRequirementsText } from "@/lib/passwordValidation";
import { OTPVerificationScreen } from "./OTPVerificationScreen";
import { GeneratingQuestionsScreen } from "./GeneratingQuestionsScreen";
import { useQuery } from "@tanstack/react-query";
import type { Region } from "@shared/schema";
import { useAdBannerActive } from "@/components/AdBanner";

interface AccountInfoPageProps {
  onBack: () => void;
}

export default function AccountInfoPage({ onBack }: AccountInfoPageProps) {
  const supabase = useSupabase();
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const adBannerActive = useAdBannerActive();
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [originalEmail, setOriginalEmail] = useState("");
  const [originalPostcode, setOriginalPostcode] = useState("");
  const [showRegionConfirm, setShowRegionConfirm] = useState(false);
  const [pendingRegion, setPendingRegion] = useState<string | null>(null);
  const [showGeneratingQuestions, setShowGeneratingQuestions] = useState(false);
  
  // Fetch available regions
  const { data: regions, isLoading: regionsLoading } = useQuery<Region[]>({
    queryKey: ['/api/regions'],
  });
  
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    region: "",
    postcode: "",
  });

  // Load profile data when available
  useEffect(() => {
    if (profile) {
      setProfileData({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        email: profile.email || "",
        region: profile.region || (regions && regions.length > 0 ? regions[0].code : ""),
        postcode: profile.postcode || "",
      });
      setOriginalEmail(profile.email || "");
      setOriginalPostcode(profile.postcode || "");
    }
  }, [profile, regions]);

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

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
      // Use the updateProfile mutation from useProfile hook
      // This automatically updates localStorage cache via the hook's onSuccess
      await updateProfile({
        region: pendingRegion,
      });

      setProfileData({ ...profileData, region: pendingRegion });
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
    setLoading(true);

    try {
      const emailChanged = profileData.email !== originalEmail;
      const postcodeChanged = profileData.postcode !== originalPostcode;

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

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to update profile in database');
        }

        await queryClient.invalidateQueries({ queryKey: ["/api/auth/profile"] });

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

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/profile"] });

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
      // Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: passwordData.currentPassword,
      });

      if (signInError) {
        throw new Error("Current password is incorrect");
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (updateError) throw updateError;

      toast({
        title: "Password changed!",
        description: "Your password has been updated successfully.",
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
    <div className={`min-h-screen flex flex-col p-4 ${adBannerActive ? 'pb-[50px]' : ''}`}>
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
                      required
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
                      {regions?.map((region) => {
                        const formatDisplay = region.defaultDateFormat === 'ddmmyy' ? 'DD/MM/YY' : 'MM/DD/YY';
                        return (
                          <SelectItem 
                            key={region.code} 
                            value={region.code} 
                            data-testid={`option-region-${region.code.toLowerCase()}-account`}
                          >
                            {region.name} ({formatDisplay})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground" data-testid="text-region-help-account">
                    This determines how dates are displayed in the game
                  </p>
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

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                {getPasswordRequirementsText()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword" data-testid="label-new-password">
                    New Password
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" data-testid="label-confirm-password">
                    Confirm New Password
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

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                  data-testid="button-change-password"
                >
                  {loading ? "Changing..." : "Change Password"}
                </Button>
              </form>
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
    </div>
  );
}
