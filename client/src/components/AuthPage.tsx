import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { validatePassword, getPasswordRequirementsText } from "@/lib/passwordValidation";
import { OTPVerificationScreen } from "./OTPVerificationScreen";
import { useSupabase } from "@/lib/SupabaseProvider";

interface AuthPageProps {
  mode: "login" | "signup" | "forgot-password";
  onSuccess: () => void;
  onSwitchMode: () => void;
  onBack: () => void;
  onForgotPassword?: () => void;
}

export default function AuthPage({ mode, onSuccess, onSwitchMode, onBack, onForgotPassword }: AuthPageProps) {
  const { signIn, signUp } = useAuth();
  const supabase = useSupabase();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });

  // Reset form when mode changes to prevent stale data
  useEffect(() => {
    setFormData({
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
    });
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
          description: validation.errors.join(', '),
          variant: "destructive",
        });
        return;
      }
    }
    
    setLoading(true);

    try {
      if (mode === "signup") {
        // Use sign-up with OTP - creates pending user and sends verification code
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              first_name: formData.firstName,
              last_name: formData.lastName,
            },
          },
        });

        if (error) throw error;

        // Show OTP verification screen
        setShowOTPVerification(true);
        toast({
          title: "Verification code sent!",
          description: `Please check ${formData.email} for your code`,
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
    // After OTP verification, create the user profile in database
    setLoading(true);
    try {
      // Get the session to verify user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("No session after verification");
      }

      // Create user profile in database
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create profile');
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
                    id="firstName"
                    data-testid="input-firstname"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" data-testid="label-lastname">Last Name</Label>
                  <Input
                    id="lastName"
                    data-testid="input-lastname"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" data-testid="label-email">Email</Label>
              <Input
                id="email"
                type="email"
                data-testid="input-email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" data-testid="label-password">Password</Label>
              <PasswordInput
                id="password"
                data-testid="input-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
                  id="confirmPassword"
                  data-testid="input-confirm-password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                />
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
