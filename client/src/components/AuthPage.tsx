import { useState, useEffect, useRef } from "react";
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
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useGameMode } from "@/contexts/GameModeContext";
import { validatePassword, getPasswordRequirementsText } from "@/lib/passwordValidation";
import { GeneratingQuestionsScreen } from "./GeneratingQuestionsScreen";
import { useSupabase } from "@/lib/SupabaseProvider";
import { useQuery } from "@tanstack/react-query";
import type { Region } from "@shared/schema";
import { useAdBannerActive } from "@/components/AdBanner";

interface AuthPageProps {
  mode: "login" | "signup" | "forgot-password";
  onSuccess: () => void;
  onSwitchMode: () => void;
  onBack: () => void;
  onForgotPassword?: () => void;
  onContinueAsGuest?: () => void;
}

export default function AuthPage({ mode, onSuccess, onSwitchMode, onBack, onForgotPassword, onContinueAsGuest }: AuthPageProps) {
  const { signIn } = useAuth();
  const supabase = useSupabase();
  const { toast } = useToast();
  const { setGameMode } = useGameMode();
  const [loading, setLoading] = useState(false);
  const adBannerActive = useAdBannerActive();
  const [showGeneratingQuestions, setShowGeneratingQuestions] = useState(false);
  const [showPostcodeWarning, setShowPostcodeWarning] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [fadeIn, setFadeIn] = useState(false);

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
    region: "", // Will be set from fetched regions
    postcode: "",
    acceptedTerms: false,
    adsConsent: false,
  });

  // Refs for automatic field progression
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const postcodeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  // Set default region from fetched regions
  useEffect(() => {
    if (regions && regions.length > 0 && !formData.region) {
      setFormData(prev => ({ ...prev, region: regions[0].code }));
    }
  }, [regions]);

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

  // Trigger fade-in animation
  useEffect(() => {
    requestAnimationFrame(() => {
      setFadeIn(true);
    });
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
      region: regions && regions.length > 0 ? regions[0].code : "", // Use first region from database
      postcode: "",
      acceptedTerms: false,   // always reset
      adsConsent: prev.adsConsent, // preserve previous choice
    }));
  }, [mode, regions]);

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

    // Check if postcode is blank and show warning
    if (!formData.postcode.trim()) {
      setShowPostcodeWarning(true);
      return;
    }
  }

  setLoading(true);

  try {
    if (mode === "signup") {
      // Direct email/password signup (no OTP verification)
      console.log("[AUTH] Calling signUp for direct email/password signup");
      
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            acceptedTerms: formData.acceptedTerms,
            adsConsent: formData.adsConsent,
          },
        },
      });

      console.log("[AUTH] signUp result:", error ? `Error: ${error.message}` : "Success");
      if (error) throw error;

      if (data.user) {
        // Try to get session - if email confirmation is disabled, we get a session immediately
        // If email confirmation is enabled, session will be null and user needs to confirm email first
        let session = data.session;
        
        if (!session) {
          // Session not immediately available - try signing in with the credentials
          console.log("[AUTH] No immediate session, attempting sign in...");
          const signInResult = await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password,
          });
          
          if (signInResult.error) {
            // If sign-in fails, it might mean email confirmation is required
            console.log("[AUTH] Sign in after signup failed:", signInResult.error.message);
            toast({
              title: "Account created!",
              description: "Please check your email to confirm your account, then log in.",
            });
            onSwitchMode(); // Switch to login mode
            setLoading(false);
            return;
          }
          
          session = signInResult.data.session;
        }

        if (!session) {
          toast({
            title: "Account created!",
            description: "Please log in with your new credentials.",
          });
          onSwitchMode(); // Switch to login mode
          return;
        }

        // Create user profile in database
        console.log("[Auth] Sending PATCH /api/auth/profile...");
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
            region: formData.region,
            postcode: formData.postcode || null,
            acceptedTerms: formData.acceptedTerms,
            adsConsent: formData.adsConsent,
            tier: "standard",
          }),
        });
        console.log("[Auth] Profile response status:", profileResponse.status);
        if (!profileResponse.ok) {
          throw new Error("Failed to create profile");
        }

        // Create initial user settings
        console.log("[Auth] Sending POST /api/settings...");
        const settingsResponse = await fetch("/api/settings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            useRegionDefault: true,
            digitPreference: "8",
          }),
        });
        console.log("[Auth] Settings response status:", settingsResponse.status);

        // Show generating questions screen for first signup
        setUserId(data.user.id);
        setShowGeneratingQuestions(true);
        
        toast({
          title: "Account created!",
          description: "Setting up your personalized questions...",
        });
      }
    } else {
      await signIn(formData.email, formData.password);
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

  // Show generating questions screen after signup
  if (mode === "signup" && showGeneratingQuestions && userId) {
    return (
      <GeneratingQuestionsScreen
        userId={userId}
        region={formData.region}
        postcode={formData.postcode}
        onComplete={() => {
          setShowGeneratingQuestions(false);
          setGameMode('global'); // Set to Global mode
          onSuccess();
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${adBannerActive ? 'pb-[60px]' : ''} bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800`}>
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
                  <InlineHelp data-testid="button-region-info">
                    <p>Puzzle questions are based on your geographical region</p>
                  </InlineHelp>
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

            {mode === "signup" && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="postcode" data-testid="label-postcode">Postcode</Label>
                  <InlineHelp data-testid="button-postcode-info">
                    <p>Your postcode helps us provide local puzzles tailored to your area</p>
                  </InlineHelp>
                </div>
                <PostcodeAutocomplete
                  value={formData.postcode}
                  onChange={(value) => setFormData({ ...formData, postcode: value })}
                  placeholder="Enter your postcode"
                  className="w-full"
                  required={false}   // we handle the “blank postcode” case with the warning dialog
                  data-testid="input-postcode"
                />
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
              className={`w-full ${
                mode === "signup" && 
                !loading && 
                formData.firstName.trim() && 
                formData.email.trim() && 
                formData.password && 
                formData.acceptedTerms
                  ? "bg-blue-700 hover:bg-blue-800"
                  : ""
              }`}
              disabled={
                loading || (
                  mode === "signup" && (
                    !formData.firstName.trim() ||
                    !formData.email.trim() ||
                    !formData.password ||
                    !formData.acceptedTerms
                  )
                )
              }
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

          {onContinueAsGuest && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={onContinueAsGuest}
                className="text-sm text-[#7DAAE8] hover:underline"
                data-testid="button-continue-guest"
              >
                Continue without logging in
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Postcode Warning Dialog */}
      <AlertDialog open={showPostcodeWarning} onOpenChange={setShowPostcodeWarning}>
        <AlertDialogContent data-testid="alert-postcode-warning">
          <AlertDialogHeader>
            <AlertDialogTitle>No postcode provided</AlertDialogTitle>
            <AlertDialogDescription>
              Without a postcode, we can't provide local puzzles. You'll only have access to general region-based puzzles. Are you sure you want to continue without entering a postcode?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowPostcodeWarning(false);
                postcodeRef.current?.focus();
              }}
              data-testid="button-cancel-postcode-warning"
            >
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={async () => {
                setShowPostcodeWarning(false);
                // Continue with signup without postcode
                setLoading(true);
                try {
                  const { data, error } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                      data: {
                        first_name: formData.firstName,
                        last_name: formData.lastName,
                        acceptedTerms: formData.acceptedTerms,
                        adsConsent: formData.adsConsent,
                      },
                    },
                  });

                  if (error) throw error;

                  if (data.user) {
                    let session = data.session;
                    
                    if (!session) {
                      // Try signing in with the credentials
                      const signInResult = await supabase.auth.signInWithPassword({
                        email: formData.email,
                        password: formData.password,
                      });
                      
                      if (signInResult.error) {
                        toast({
                          title: "Account created!",
                          description: "Please check your email to confirm your account, then log in.",
                        });
                        onSwitchMode();
                        setLoading(false);
                        return;
                      }
                      session = signInResult.data.session;
                    }

                    if (!session) {
                      toast({
                        title: "Account created!",
                        description: "Please log in with your new credentials.",
                      });
                      onSwitchMode();
                      return;
                    }

                    // Create user profile
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
                        region: formData.region,
                        postcode: null, // No postcode
                        acceptedTerms: formData.acceptedTerms,
                        adsConsent: formData.adsConsent,
                        tier: "standard",
                      }),
                    });
                    if (!profileResponse.ok) throw new Error("Failed to create profile");

                    // Create initial settings
                    await fetch("/api/settings", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${session.access_token}`,
                      },
                      body: JSON.stringify({ useRegionDefault: true, digitPreference: "8" }),
                    });

                    setUserId(data.user.id);
                    setShowGeneratingQuestions(true);
                    toast({
                      title: "Account created!",
                      description: "Setting up your personalized questions...",
                    });
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
              }}
              data-testid="button-confirm-postcode-warning"
            >
              Continue Without Postcode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
