import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSupabase } from "@/lib/SupabaseProvider";
import { SiGoogle, SiApple } from "react-icons/si";
import { validatePassword, getPasswordRequirementsText } from "@/lib/passwordValidation";
import { isIosPwa } from "@/lib/pwaContext";

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

interface LoginPageProps {
  onSuccess: () => void;
  onBack: () => void;
  onSignup: () => void;
  onForgotPassword?: (email: string) => void;
  onPersonalise?: (email: string, password?: string) => void;
  subtitle?: string; // Optional subtitle to show below the main title
  prefilledEmail?: string; // Pre-fill email field when returning from personalise
}

type LoginStep = "email" | "password" | "magic-link" | "create-account" | "set-password";

interface UserAuthInfo {
  exists: boolean;
  hasPassword: boolean;
  hasMagicLink: boolean;
  magicLinkEnabled: boolean;
  googleLinked: boolean;
  appleLinked: boolean;
}

const MAGIC_LINK_COOLDOWN_SECONDS = 60;

export default function LoginPage({ onSuccess, onBack, onSignup, onForgotPassword, onPersonalise, subtitle, prefilledEmail }: LoginPageProps) {
  const { signIn, isAuthenticated } = useAuth();
  const supabase = useSupabase();
  const { toast } = useToast();
  
  // If user is already authenticated and came from personalise screen, redirect them back
  useEffect(() => {
    if (isAuthenticated && prefilledEmail) {
      console.log('[LoginPage] User already authenticated with prefilled email, calling onSuccess');
      onSuccess();
    }
  }, [isAuthenticated, prefilledEmail, onSuccess]);
  
  const [email, setEmail] = useState(prefilledEmail || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<LoginStep>("email");
  const [loading, setLoading] = useState(false);
  const [sendingMagicLink, setSendingMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkCooldown, setMagicLinkCooldown] = useState(0);
  const [userAuthInfo, setUserAuthInfo] = useState<UserAuthInfo | null>(null);
  const [fadeIn, setFadeIn] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);
  
  // Check if running in iOS PWA context (magic links don't work in PWA)
  const isInIosPwa = useMemo(() => isIosPwa(), []);

  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isDarkMode, setIsDarkMode] = useState(() => 
    document.documentElement.classList.contains('dark')
  );
  
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDarkMode(document.documentElement.classList.contains('dark'));
        }
      });
    });
    
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
    };
  }, []);
  
  const backgroundColor = useMemo(() => {
    return isDarkMode ? 'hsl(222, 47%, 11%)' : '#FAFAFA';
  }, [isDarkMode]);
  
  const textColor = useMemo(() => {
    return isDarkMode ? '#FAFAFA' : '#54524F';
  }, [isDarkMode]);

  const secondaryTextColor = useMemo(() => {
    return isDarkMode ? 'rgba(255, 255, 255, 0.7)' : '#666';
  }, [isDarkMode]);

  useEffect(() => {
    requestAnimationFrame(() => {
      setFadeIn(true);
    });
  }, []);

  const startCooldown = () => {
    setMagicLinkCooldown(MAGIC_LINK_COOLDOWN_SECONDS);
    
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
    }
    
    cooldownIntervalRef.current = setInterval(() => {
      setMagicLinkCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownIntervalRef.current) {
            clearInterval(cooldownIntervalRef.current);
            cooldownIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleEmailContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch(`/api/auth/check-user?email=${encodeURIComponent(email.trim())}`);
      const data = await response.json();
      
      if (data.exists) {
        setUserAuthInfo(data);
        if (data.hasPassword) {
          setStep("password");
        } else {
          // User exists but has no password
          // In iOS PWA, they must create a password (magic links don't work in PWA)
          if (isInIosPwa) {
            setStep("set-password");
          } else {
            setStep("magic-link");
          }
        }
      } else {
        setStep("create-account");
      }
    } catch (error) {
      console.error("[LoginPage] Error checking user:", error);
      toast({
        title: "Error",
        description: "Failed to check account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      toast({
        title: "Password required",
        description: "Please enter your password.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        toast({
          title: "Login failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.session) {
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

  const handleSendMagicLink = async (isNewAccount: boolean = false) => {
    setSendingMagicLink(true);
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin,
          shouldCreateUser: isNewAccount,
        },
      });

      if (error) {
        if (error.message.includes("rate") || error.message.includes("limit")) {
          toast({
            title: "Too many requests",
            description: "Please wait a few minutes before requesting another link.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error sending link",
            description: error.message,
            variant: "destructive",
          });
        }
        return;
      }

      setMagicLinkSent(true);
      startCooldown();
      toast({
        title: "Link sent!",
        description: "Check your inbox for a secure login link. It expires in 5 minutes.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send magic link",
        variant: "destructive",
      });
    } finally {
      setSendingMagicLink(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      toast({
        title: "Password required",
        description: "Please enter and confirm your password.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      toast({
        title: "Invalid Password",
        description: validation.errors.join(", "),
        variant: "destructive",
      });
      return;
    }

    setCreatingAccount(true);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_login_completed: false,
          },
        },
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        let session = data.session;
        
        if (!session) {
          const signInResult = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          
          if (signInResult.error) {
            toast({
              title: "Account created!",
              description: "Please check your email to confirm your account, then log in.",
            });
            setStep("email");
            return;
          }
          
          session = signInResult.data.session;
        }

        // Mark password_created and signup_method in user_profiles since user created account with password
        if (session) {
          try {
            await fetch('/api/auth/profile/password-created', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ setSignupMethod: true }), // Also set signup_method='password'
            });
          } catch (err) {
            console.error('[LoginPage] Error setting password_created:', err);
          }
        }

        if (onPersonalise) {
          onPersonalise(email.trim(), password);
        } else {
          onSuccess();
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleEditEmail = () => {
    setStep("email");
    setPassword("");
    setConfirmPassword("");
    setUserAuthInfo(null);
    setMagicLinkSent(false);
    setMagicLinkCooldown(0);
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = null;
    }
  };

  // Handle sending password reset for iOS PWA users who need to create a password
  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setSettingPassword(true);
    
    try {
      const response = await fetch('/api/auth/send-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email');
      }
      
      toast({
        title: "Email sent",
        description: "Check your email for a link to set your password. After setting it, return to this app to log in.",
      });
      
      // Stay on this screen so user knows what to do next
      setMagicLinkSent(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset email",
        variant: "destructive",
      });
    } finally {
      setSettingPassword(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
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
      // User will be redirected to Google for authentication
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in with Google",
        variant: "destructive",
      });
    }
  };

  const handleAppleLogin = () => {
    toast({
      title: "Coming soon",
      description: "Apple login will be available soon.",
    });
  };

  const getMagicLinkButtonText = () => {
    if (sendingMagicLink) return "Sending...";
    if (magicLinkCooldown > 0) return `Resend in ${magicLinkCooldown}s`;
    if (magicLinkSent) return "Resend link";
    return "Email me a one-time sign in link";
  };

  // Get the step title for the header
  const getStepTitle = () => {
    switch (step) {
      case "email": return "Log in";
      case "password": return "Welcome back";
      case "magic-link": return "Welcome back";
      case "create-account": return "Create account";
      case "set-password": return "Set password";
      default: return "Log in";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: fadeIn ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="fixed inset-0 flex flex-col z-50 overflow-y-auto"
      style={{ backgroundColor }}
      data-testid="login-page"
    >
      {/* Header - matching AccountInfoPage style */}
      <div className="flex items-center justify-between p-4 mb-2" style={{ backgroundColor }}>
        <button
          onClick={step === "email" ? onBack : handleEditEmail}
          data-testid="button-back"
          className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft className="h-9 w-9 text-gray-700 dark:text-gray-300" />
        </button>

        <div className="flex flex-col items-center">
          <h1 
            className="text-4xl font-bold"
            style={{ color: textColor }}
            data-testid="text-title"
          >
            {getStepTitle()}
          </h1>
        </div>

        {/* Spacer to balance layout */}
        <div className="w-14" />
      </div>

      <div className="flex-1 flex flex-col items-center px-4 pb-12 max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          {step === "email" && (
            <motion.div
              key="email-step"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <Card className="w-full">
                <CardContent className="pt-6 space-y-4">
                  {subtitle && (
                    <p 
                      className="text-center text-sm text-muted-foreground"
                      data-testid="text-subtitle"
                    >
                      {subtitle}
                    </p>
                  )}

                  <form onSubmit={handleEmailContinue} className="space-y-4">
                    <div className="space-y-2">
                      <label 
                        htmlFor="email" 
                        className="text-sm font-medium"
                        style={{ color: textColor }}
                      >
                        Email address
                      </label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="w-full"
                        data-testid="input-email"
                        autoFocus
                      />
                    </div>

                    <Button
                      type="submit"
                      className={`w-full py-6 text-lg font-semibold ${
                        isValidEmail(email) && !loading
                          ? "bg-blue-700 hover:bg-blue-800 text-white"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      }`}
                      disabled={loading || !isValidEmail(email)}
                      data-testid="button-continue"
                    >
                      {loading ? "Checking..." : "Continue"}
                    </Button>
                  </form>

                  <div className="flex items-center my-2">
                    <div className="flex-1 border-t" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#ddd' }} />
                    <span className="px-4 text-sm" style={{ color: secondaryTextColor }}>or</span>
                    <div className="flex-1 border-t" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#ddd' }} />
                  </div>

                  <div className="space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full py-6 text-base font-medium border-2"
                      onClick={handleGoogleLogin}
                      data-testid="button-google"
                    >
                      <SiGoogle className="w-5 h-5 mr-3" />
                      Continue with Google
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full py-6 text-base font-medium border-2"
                      onClick={handleAppleLogin}
                      data-testid="button-apple"
                    >
                      <SiApple className="w-5 h-5 mr-3" />
                      Continue with Apple
                    </Button>
                  </div>

                  <p className="text-xs text-center text-muted-foreground">
                    By continuing, you agree to the{" "}
                    <a href="/terms" className="underline">Terms of Sale</a>,{" "}
                    <a href="/terms" className="underline">Terms of Service</a>, and{" "}
                    <a href="/privacy" className="underline">Privacy Policy</a>.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === "password" && (
            <motion.div
              key="password-step"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <Card className="w-full">
                <CardContent className="pt-6 space-y-4">
                  <p className="text-center text-muted-foreground">
                    Enter your password to log in.
                  </p>

                  <form onSubmit={handlePasswordLogin} className="space-y-4">
                    <div className="space-y-2">
                      <label 
                        htmlFor="email-display" 
                        className="text-sm font-medium"
                        style={{ color: textColor }}
                      >
                        Email address
                      </label>
                      <div className="relative">
                        <Input
                          id="email-display"
                          type="email"
                          value={email}
                          disabled
                          className="w-full pr-16 bg-muted"
                          data-testid="input-email-display"
                        />
                        <button
                          type="button"
                          onClick={handleEditEmail}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-blue-600 dark:text-blue-400"
                          data-testid="button-edit-email"
                        >
                          Edit
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label 
                        htmlFor="password" 
                        className="text-sm font-medium"
                        style={{ color: textColor }}
                      >
                        Password
                      </label>
                      <PasswordInput
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full"
                        data-testid="input-password"
                        autoFocus
                      />
                    </div>

                    {onForgotPassword && (
                      <button
                        type="button"
                        onClick={() => onForgotPassword(email)}
                        className="text-sm underline text-blue-600 dark:text-blue-400"
                        data-testid="button-forgot-password"
                      >
                        Forgot your password?
                      </button>
                    )}

                    <Button
                      type="submit"
                      className={`w-full py-6 text-lg font-semibold ${
                        password && !loading
                          ? "bg-blue-700 hover:bg-blue-800 text-white"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      }`}
                      disabled={loading || !password}
                      data-testid="button-login"
                    >
                      {loading ? "Logging in..." : "Log in"}
                    </Button>
                  </form>

                  {/* Other login options - show based on what user has activated */}
                  <div className="space-y-3">
                    {/* Magic link - only show if enabled and not iOS PWA */}
                    {!isInIosPwa && userAuthInfo?.magicLinkEnabled !== false && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full py-6 text-base font-medium border-2"
                        onClick={() => handleSendMagicLink(false)}
                        disabled={sendingMagicLink || magicLinkCooldown > 0}
                        data-testid="button-magic-link"
                      >
                        {getMagicLinkButtonText()}
                      </Button>
                    )}

                    {/* Google - only show if user has linked Google */}
                    {userAuthInfo?.googleLinked && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full py-6 text-base font-medium border-2"
                        onClick={handleGoogleLogin}
                        data-testid="button-google-login"
                      >
                        <SiGoogle className="w-5 h-5 mr-3" />
                        Continue with Google
                      </Button>
                    )}

                    {/* Apple - only show if user has linked Apple */}
                    {userAuthInfo?.appleLinked && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full py-6 text-base font-medium border-2"
                        onClick={handleAppleLogin}
                        data-testid="button-apple-login"
                      >
                        <SiApple className="w-5 h-5 mr-3" />
                        Continue with Apple
                      </Button>
                    )}
                  </div>

                  {magicLinkSent && !isInIosPwa && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-center p-3 rounded-lg"
                      style={{ 
                        backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)',
                        color: isDarkMode ? '#86efac' : '#166534'
                      }}
                      data-testid="text-magic-link-success"
                    >
                      Check your inbox for a secure login link. It expires in 5 minutes.
                    </motion.p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === "magic-link" && (
            <motion.div
              key="magic-link-step"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <Card className="w-full">
                <CardContent className="pt-6 space-y-4">
                  <p className="text-center text-muted-foreground">
                    We'll send you a secure login link.
                  </p>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label 
                        htmlFor="email-display" 
                        className="text-sm font-medium"
                        style={{ color: textColor }}
                      >
                        Email address
                      </label>
                      <div className="relative">
                        <Input
                          id="email-display"
                          type="email"
                          value={email}
                          disabled
                          className="w-full pr-16 bg-muted"
                          data-testid="input-email-display"
                        />
                        <button
                          type="button"
                          onClick={handleEditEmail}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-blue-600 dark:text-blue-400"
                          data-testid="button-edit-email"
                        >
                          Edit
                        </button>
                      </div>
                    </div>

                    <Button
                      type="button"
                      className="w-full bg-blue-700 hover:bg-blue-800 text-white py-6 text-lg font-semibold"
                      onClick={() => handleSendMagicLink(false)}
                      disabled={sendingMagicLink || magicLinkCooldown > 0}
                      data-testid="button-send-magic-link"
                    >
                      {getMagicLinkButtonText()}
                    </Button>

                    {/* OAuth options - show if user has linked them */}
                    {userAuthInfo?.googleLinked && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full py-6 text-base font-medium border-2"
                        onClick={handleGoogleLogin}
                        data-testid="button-google-login"
                      >
                        <SiGoogle className="w-5 h-5 mr-3" />
                        Continue with Google
                      </Button>
                    )}

                    {userAuthInfo?.appleLinked && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full py-6 text-base font-medium border-2"
                        onClick={handleAppleLogin}
                        data-testid="button-apple-login"
                      >
                        <SiApple className="w-5 h-5 mr-3" />
                        Continue with Apple
                      </Button>
                    )}

                    {magicLinkSent && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-center p-3 rounded-lg"
                        style={{ 
                          backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)',
                          color: isDarkMode ? '#86efac' : '#166534'
                        }}
                        data-testid="text-magic-link-success"
                      >
                        Check your inbox for a secure login link. It expires in 5 minutes.
                      </motion.p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === "set-password" && (
            <motion.div
              key="set-password-step"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <Card className="w-full">
                <CardContent className="pt-6 space-y-4">
                  <p className="text-center text-muted-foreground">
                    To sign in via the app, you need to set up a password.
                  </p>
                  <p className="text-center text-xs text-muted-foreground">
                    We'll send you an email with a link to create your password. After setting it, return here to sign in.
                  </p>

                  <form onSubmit={handleSendPasswordReset} className="space-y-4">
                    <div className="space-y-2">
                      <label 
                        htmlFor="email-display" 
                        className="text-sm font-medium"
                        style={{ color: textColor }}
                      >
                        Email address
                      </label>
                      <div className="relative">
                        <Input
                          id="email-display"
                          type="email"
                          value={email}
                          disabled
                          className="w-full pr-16 bg-muted"
                          data-testid="input-email-display"
                        />
                        <button
                          type="button"
                          onClick={handleEditEmail}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-blue-600 dark:text-blue-400"
                          data-testid="button-edit-email"
                        >
                          Edit
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-blue-700 hover:bg-blue-800 text-white py-6 text-lg font-semibold"
                      disabled={settingPassword || magicLinkSent}
                      data-testid="button-send-password-reset"
                    >
                      {settingPassword ? "Sending..." : magicLinkSent ? "Email sent" : "Send password setup email"}
                    </Button>

                    {magicLinkSent && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-center p-3 rounded-lg space-y-2"
                        style={{ 
                          backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)',
                          color: isDarkMode ? '#86efac' : '#166534'
                        }}
                      >
                        <p>Check your email and click the link to set your password.</p>
                        <p>After setting your password, return here and enter it to sign in.</p>
                      </motion.div>
                    )}

                    {magicLinkSent && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full py-6 text-base font-medium border-2"
                        onClick={handleEditEmail}
                        data-testid="button-back-to-login"
                      >
                        Back to sign in
                      </Button>
                    )}
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === "create-account" && (
            <motion.div
              key="create-account-step"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <Card className="w-full">
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <label 
                      htmlFor="email-display" 
                      className="text-sm font-medium"
                      style={{ color: textColor }}
                    >
                      Email address
                    </label>
                    <div className="relative">
                      <Input
                        id="email-display"
                        type="email"
                        value={email}
                        disabled
                        className="w-full pr-16 bg-muted"
                        data-testid="input-email-display"
                      />
                      <button
                        type="button"
                        onClick={handleEditEmail}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-blue-600 dark:text-blue-400"
                        data-testid="button-edit-email"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  {/* Hide magic link option for iOS PWA users */}
                  {!isInIosPwa && (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                      >
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full py-6 text-base font-medium border-2"
                          onClick={() => handleSendMagicLink(true)}
                          disabled={sendingMagicLink || magicLinkCooldown > 0}
                          data-testid="button-magic-link-signup"
                        >
                          {getMagicLinkButtonText()}
                        </Button>
                      </motion.div>

                      {magicLinkSent && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-center p-3 rounded-lg"
                          style={{ 
                            backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)',
                            color: isDarkMode ? '#86efac' : '#166534'
                          }}
                          data-testid="text-magic-link-success"
                        >
                          Check your inbox for a secure sign up link. It expires in 5 minutes.
                        </motion.p>
                      )}

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: 0.2 }}
                        className="flex items-center my-2"
                      >
                        <div className="flex-1 border-t" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#ddd' }} />
                        <span className="px-4 text-sm" style={{ color: secondaryTextColor }}>or</span>
                        <div className="flex-1 border-t" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#ddd' }} />
                      </motion.div>
                    </>
                  )}

                  <motion.form
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                    onSubmit={handleCreateAccount}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <label 
                        htmlFor="new-password" 
                        className="text-sm font-medium"
                        style={{ color: textColor }}
                      >
                        Password
                      </label>
                      <PasswordInput
                        id="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a password"
                        className="w-full"
                        data-testid="input-password"
                      />
                      <p className="text-xs text-muted-foreground">
                        {getPasswordRequirementsText()}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label 
                        htmlFor="confirm-password" 
                        className="text-sm font-medium"
                        style={{ color: textColor }}
                      >
                        Confirm Password
                      </label>
                      <PasswordInput
                        id="confirm-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm your password"
                        className="w-full"
                        data-testid="input-confirm-password"
                      />
                    </div>

                    <p className="text-xs text-center text-muted-foreground">
                      By creating an account, you agree to the{" "}
                      <a href="/terms" className="underline">Terms of Sale</a>,{" "}
                      <a href="/terms" className="underline">Terms of Service</a>, and{" "}
                      <a href="/privacy" className="underline">Privacy Policy</a>.
                    </p>

                    <Button
                      type="submit"
                      className={`w-full py-6 text-lg font-semibold ${
                        validatePassword(password).valid && password === confirmPassword && !creatingAccount
                          ? "bg-blue-700 hover:bg-blue-800 text-white"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      }`}
                      disabled={creatingAccount || !validatePassword(password).valid || password !== confirmPassword}
                      data-testid="button-create-account"
                    >
                      {creatingAccount ? "Creating account..." : "Create account"}
                    </Button>
                  </motion.form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div 
        className="py-4 text-center text-xs border-t"
        style={{ 
          borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#eee',
          color: secondaryTextColor 
        }}
      >
        <a href="/privacy" className="underline mx-2">Privacy Policy</a>
        <span>|</span>
        <a href="/help" className="underline mx-2">Help</a>
      </div>
    </motion.div>
  );
}
