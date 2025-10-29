import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { validatePassword, getPasswordRequirementsText } from "@/lib/passwordValidation";
import { OTPVerificationScreen } from "./OTPVerificationScreen";
import { useSupabase } from "@/lib/SupabaseProvider";
import { useQuery } from "@tanstack/react-query";
import type { Region } from "@shared/schema";

interface AuthPageProps {
  mode: "login" | "signup" | "forgot-password";
  onSuccess: () => void;
  onSwitchMode: () => void;
  onBack: () => void;
  onForgotPassword?: () => void;
}

export default function AuthPage({ mode, onSuccess, onSwitchMode, onBack, onForgotPassword }: AuthPageProps) {
  const { signIn } = useAuth();
  const supabase = useSupabase();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showOTPVerification, setShowOTPVerification] = useState(false);

  // Fetch available regions
  const { data: regions, isLoading: regionsLoading } = useQuery<Region[]>({
    queryKey: ['/api/regions'],
    enabled: mode === 'signup',
  });

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    region: "UK", // Default to UK
    acceptedTerms: false,
    adsConsent: false,
  });

  // Refs for automatic field progression
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  // Load saved adsConsent from localStorage on mount
  useEffect(() => {
    const savedAdsConsent = localStorage.getItem("adsConsent");
    if (savedAdsConsent !== null) {
      setFormData((prev) => ({
        ...prev,
        adsConsent: savedAdsConsent === "true",
      }));
    }
  }, []);

  // Persist adsConsent to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("adsConsent", String(formData.adsConsent));
  }, [formData.adsConsent]);

  // Reset form when mode changes to prevent stale data
  useEffect(() => {
    setFormData((prev) => ({
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      region: "UK", // reset to default
      acceptedTerms: false,   // always reset
      adsConsent: prev.adsConsent, // preserve previous choice
    }));
  }, [mode]);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // Validate password for signup
  if (mode === "signup") {
    // Check if passwords match first for clearer feedback
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    // Then check password strength
    const validation = validatePassword(formData.password);
    if (!validation.valid) {
      toast({
        title: "Invalid Password",
        description: validation.errors.join(", "),
        variant: "destructive",
      });
      return;
    }
  }

  setLoading(true);

  try {
    if (mode === "signup") {
      // Send OTP code to email (this sends a 6-digit code, not a confirmation link)
      console.log("[AUTH] Calling signInWithOtp for signup");
      console.log("[AUTH] Parameters: { shouldCreateUser: true, emailRedirectTo: undefined }");

      const { error } = await supabase.auth.signInWithOtp({
        email: formData.email,
        options: {
          shouldCreateUser: true,
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            acceptedTerms: formData.acceptedTerms,
            adsConsent: formData.adsConsent,
          },
        },
      });

      console.log(
        "[AUTH] signInWithOtp result:",
        error ? `Error: ${error.message}` : "Success - OTP sent"
      );
      if (error) throw error;

      // Show OTP verification screen
      setShowOTPVerification(true);
      toast({
        title: "Verification code sent!",
        description: `Please check ${formData.email} for your 6-digit code`,
      });
    } else {
      await signIn(formData.email, formData.password);
    }

    // Only call onSuccess for login, not signup (signup success happens after OTP verification)
    if (mode !== "signup") {
      onSuccess();
    }
  } catch (error: any) {
    toast({
      title: "Error",
      description: error.message || "Authentication failed",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
};

  const handleOTPVerified = async () => {
    // After OTP verification, set password and create the user profile in database
    setLoading(true);
    try {
      // Get the session to verify user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No session after verification");
      }

      // Set the password for the account (OTP login creates passwordless account)
      const { error: passwordError } = await supabase.auth.updateUser({
        password: formData.password,
      });
      if (passwordError) {
        throw passwordError;
      }

      // Create or update user profile in database (including region)
      const profileResponse = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          region: formData.region, // Save region to profile
          acceptedTerms: formData.acceptedTerms,
          adsConsent: formData.adsConsent,
        }),
      });

      if (!profileResponse.ok) {
        throw new Error("Failed to create profile");
      }

      // Create initial user settings with date format defaults
      const settingsResponse = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          useRegionDefault: true, // Auto-detect format from region
          digitPreference: "6", // Default to 6-digit format
        }),
      });

      if (!settingsResponse.ok) {
        console.warn("Failed to create settings, but profile was created");
      }

      toast({
        title: "Account created!",
        description: "Welcome to Elementle!",
      });
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error creating account",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const handleCancelVerification = () => {
    setShowOTPVerification(false);
    toast({
      title: "Verification cancelled",
      description: "You can edit your details and try again",
    });
  };

  // Show OTP verification screen for signup
  if (mode === "signup" && showOTPVerification) {
    return (
      <OTPVerificationScreen
        email={formData.email}
        type="signup"
        onVerified={handleOTPVerified}
        onCancel={handleCancelVerification}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">
            {mode === "signup" ? "Create an account" : "Welcome back"}
          </CardTitle>
          <CardDescription className="text-center">
            {mode === "signup" 
              ? "Enter your details to create your account" 
              : "Enter your email and password to sign in"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" data-testid="label-firstname">First Name</Label>
                  <Input
                    ref={firstNameRef}
                    id="firstName"
                    data-testid="input-firstname"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && formData.firstName) {
                        e.preventDefault();
                        lastNameRef.current?.focus();
                      }
                    }}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" data-testid="label-lastname">Last Name</Label>
                  <Input
                    ref={lastNameRef}
                    id="lastName"
                    data-testid="input-lastname"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && formData.lastName) {
                        e.preventDefault();
                        emailRef.current?.focus();
                      }
                    }}
                    required
                  />
                </div>
              </div>
            )}
            
            {mode === "signup" && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="region" data-testid="label-region">Region</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        type="button" 
                        className="inline-flex items-center justify-center w-4 h-4 text-xs rounded-full border border-muted-foreground/30 text-muted-foreground hover:bg-muted transition-colors"
                        data-testid="button-region-info"
                      >
                        i
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Puzzle questions are based on your geographical region</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={formData.region}
                  onValueChange={(value) => setFormData({ ...formData, region: value })}
                  disabled={regionsLoading}
                >
                  <SelectTrigger id="region" data-testid="select-region">
                    <SelectValue placeholder={regionsLoading ? "Loading regions..." : "Select your region"} />
                  </SelectTrigger>
                  <SelectContent>
                    {regions?.map((region) => {
                      const formatDisplay = region.defaultDateFormat === 'ddmmyy' ? 'DD/MM/YY' : 'MM/DD/YY';
                      return (
                        <SelectItem 
                          key={region.code} 
                          value={region.code} 
                          data-testid={`option-region-${region.code.toLowerCase()}`}
                        >
                          {region.name} ({formatDisplay})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground" data-testid="text-region-help">
                  This determines how dates are displayed in the game
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" data-testid="label-email">Email</Label>
              <Input
                ref={emailRef}
                id="email"
                type="email"
                data-testid="input-email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && formData.email) {
                    e.preventDefault();
                    passwordRef.current?.focus();
                  }
                }}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" data-testid="label-password">Password</Label>
              <PasswordInput
                ref={passwordRef}
                id="password"
                data-testid="input-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && formData.password && mode === 'signup') {
                    e.preventDefault();
                    confirmPasswordRef.current?.focus();
                  }
                }}
                autoComplete="new-password"
                required
              />
              {mode === "signup" && (
                <p className="text-xs text-muted-foreground" data-testid="text-password-requirements">
                  {getPasswordRequirementsText()}
                </p>
              )}
              {mode === "login" && onForgotPassword && (
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-xs text-primary hover:underline"
                  data-testid="button-forgot-password"
                >
                  Forgot password?
                </button>
              )}
            </div>

            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" data-testid="label-confirm-password">Confirm Password</Label>
                <PasswordInput
                  ref={confirmPasswordRef}
                  id="confirmPassword"
                  data-testid="input-confirm-password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  autoComplete="new-password"
                  required
                />
              </div>
            )}

            {mode === "signup" && (
              <div className="space-y-4">
                <div className="flex items-start space-x-2">
                  <input
                    id="acceptedTerms"
                    type="checkbox"
                    checked={formData.acceptedTerms}
                    onChange={(e) =>
                      setFormData({ ...formData, acceptedTerms: e.target.checked })
                    }
                    required
                    className="mt-1"
                  />
                  <label htmlFor="acceptedTerms" className="text-sm">
                    I accept the{" "}
                    <a href="/terms" className="text-primary underline">Terms of Service</a> and{" "}
                    <a href="/privacy" className="text-primary underline">Privacy Policy</a>.
                  </label>
                </div>

                <div className="flex items-start space-x-2">
                  <input
                    id="adsConsent"
                    type="checkbox"
                    checked={formData.adsConsent}
                    onChange={(e) =>
                      setFormData({ ...formData, adsConsent: e.target.checked })
                    }
                    className="mt-1"
                  />
                  <label htmlFor="adsConsent" className="text-sm">
                    I agree to receive tailored ads and promotional content (optional).
                  </label>
                </div>
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
              data-testid="button-submit"
            >
              {loading ? "Please wait..." : mode === "signup" ? "Sign Up" : "Sign In"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={onSwitchMode}
              className="text-primary hover:underline"
              data-testid="button-switch-mode"
            >
              {mode === "signup" 
                ? "Already have an account? Sign in" 
                : "Don't have an account? Sign up"}
            </button>
          </div>

          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-muted-foreground hover:underline"
              data-testid="button-back"
            >
              Back to welcome
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
