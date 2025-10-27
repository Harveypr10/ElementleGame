import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface AccountInfoPageProps {
  onBack: () => void;
}

export default function AccountInfoPage({ onBack }: AccountInfoPageProps) {
  const supabase = useSupabase();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [originalEmail, setOriginalEmail] = useState("");
  const [showRegionConfirm, setShowRegionConfirm] = useState(false);
  const [pendingRegion, setPendingRegion] = useState<string | null>(null);
  
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    region: "",
  });

  // Load profile data when available
  useEffect(() => {
    if (profile) {
      setProfileData({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        email: profile.email || "",
        region: profile.region || "GB",
      });
      setOriginalEmail(profile.email || "");
    }
  }, [profile]);

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleRegionChange = (newRegion: string) => {
    setPendingRegion(newRegion);
    setShowRegionConfirm(true);
  };

  const handleConfirmRegionChange = async () => {
    if (!pendingRegion) return;

    setLoading(true);
    setShowRegionConfirm(false);

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          region: pendingRegion,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update region');
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/profile"] });

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
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update profile in database');
        }

        await queryClient.invalidateQueries({ queryKey: ["/api/auth/profile"] });

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
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile in database');
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
    <div className="min-h-screen flex flex-col p-4">
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


      <div className="flex-1 flex items-start justify-center pb-8">
        <div className="w-full max-w-md space-y-6">
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
                  <Label htmlFor="region" data-testid="label-region-account">
                    Region
                  </Label>
                  <Select
                    value={profileData.region}
                    onValueChange={handleRegionChange}
                  >
                    <SelectTrigger id="region" data-testid="select-region-account">
                      <SelectValue placeholder="Select your region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GB" data-testid="option-region-uk-account">United Kingdom (DD/MM/YY)</SelectItem>
                      <SelectItem value="US" data-testid="option-region-us-account">United States (MM/DD/YY)</SelectItem>
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
