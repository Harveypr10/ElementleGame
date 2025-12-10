import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSupabase } from "@/lib/SupabaseProvider";
import { SiGoogle, SiApple } from "react-icons/si";

interface LoginPageProps {
  onSuccess: () => void;
  onBack: () => void;
  onSignup: () => void;
  onForgotPassword?: () => void;
}

type LoginStep = "email" | "password" | "magic-link";

interface UserAuthInfo {
  exists: boolean;
  hasPassword: boolean;
  hasMagicLink: boolean;
}

export default function LoginPage({ onSuccess, onBack, onSignup, onForgotPassword }: LoginPageProps) {
  const { signIn } = useAuth();
  const supabase = useSupabase();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<LoginStep>("email");
  const [loading, setLoading] = useState(false);
  const [sendingMagicLink, setSendingMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [userAuthInfo, setUserAuthInfo] = useState<UserAuthInfo | null>(null);
  const [fadeIn, setFadeIn] = useState(false);

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
          setStep("magic-link");
        }
      } else {
        toast({
          title: "Account not found",
          description: "No account exists with this email. Would you like to create one?",
          variant: "destructive",
        });
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

  const handleSendMagicLink = async () => {
    setSendingMagicLink(true);
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin,
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

  const handleEditEmail = () => {
    setStep("email");
    setPassword("");
    setUserAuthInfo(null);
    setMagicLinkSent(false);
  };

  const handleGoogleLogin = () => {
    toast({
      title: "Coming soon",
      description: "Google login will be available soon.",
    });
  };

  const handleAppleLogin = () => {
    toast({
      title: "Coming soon",
      description: "Apple login will be available soon.",
    });
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
      <div className="sticky top-0 z-10 flex items-center justify-between p-4" style={{ backgroundColor }}>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm hover:opacity-70 transition-opacity"
          style={{ color: textColor }}
          data-testid="button-back"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <h1 
          className="text-xl font-bold absolute left-1/2 transform -translate-x-1/2"
          style={{ color: textColor }}
          data-testid="text-title"
        >
          Elementle
        </h1>
        <div className="w-12" />
      </div>

      <div className="flex-1 flex flex-col items-center px-6 pt-8 pb-12 max-w-md mx-auto w-full">
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
              <h2 
                className="text-2xl font-bold text-center mb-8"
                style={{ color: textColor }}
                data-testid="text-heading"
              >
                Log in or create an account
              </h2>

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
                  className="w-full bg-[#1a1a1a] hover:bg-[#333] text-white py-6 text-lg font-semibold"
                  disabled={loading}
                  data-testid="button-continue"
                >
                  {loading ? "Checking..." : "Continue"}
                </Button>
              </form>

              <div className="flex items-center my-6">
                <div className="flex-1 border-t" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#ddd' }} />
                <span className="px-4 text-sm" style={{ color: secondaryTextColor }}>or</span>
                <div className="flex-1 border-t" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#ddd' }} />
              </div>

              <p className="text-xs text-center mb-4" style={{ color: secondaryTextColor }}>
                By continuing, you agree to the{" "}
                <a href="/terms" className="underline">Terms of Sale</a>,{" "}
                <a href="/terms" className="underline">Terms of Service</a>, and{" "}
                <a href="/privacy" className="underline">Privacy Policy</a>.
              </p>

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

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={onSignup}
                  className="text-sm underline"
                  style={{ color: textColor }}
                  data-testid="button-signup"
                >
                  Don't have an account? Sign up
                </button>
              </div>
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
              <h2 
                className="text-2xl font-bold text-center mb-2"
                style={{ color: textColor }}
                data-testid="text-heading"
              >
                Welcome back
              </h2>
              <p 
                className="text-center mb-8"
                style={{ color: secondaryTextColor }}
              >
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium"
                      style={{ color: textColor }}
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
                    onClick={onForgotPassword}
                    className="text-sm underline"
                    style={{ color: textColor }}
                    data-testid="button-forgot-password"
                  >
                    Forgot your password?
                  </button>
                )}

                <Button
                  type="submit"
                  className="w-full bg-[#1a1a1a] hover:bg-[#333] text-white py-6 text-lg font-semibold"
                  disabled={loading}
                  data-testid="button-login"
                >
                  {loading ? "Logging in..." : "Log in"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full py-6 text-base font-medium border-2"
                  onClick={handleSendMagicLink}
                  disabled={sendingMagicLink || magicLinkSent}
                  data-testid="button-magic-link"
                >
                  {sendingMagicLink ? "Sending..." : magicLinkSent ? "Link sent! Check your inbox" : "Email me a one-time sign in link"}
                </Button>
              </form>

              {magicLinkSent && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-center mt-4 p-3 rounded-lg"
                  style={{ 
                    backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)',
                    color: isDarkMode ? '#86efac' : '#166534'
                  }}
                  data-testid="text-magic-link-success"
                >
                  Check your inbox for a secure login link. It expires in 5 minutes.
                </motion.p>
              )}
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
              <h2 
                className="text-2xl font-bold text-center mb-2"
                style={{ color: textColor }}
                data-testid="text-heading"
              >
                Welcome back
              </h2>
              <p 
                className="text-center mb-8"
                style={{ color: secondaryTextColor }}
              >
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium"
                      style={{ color: textColor }}
                      data-testid="button-edit-email"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <Button
                  type="button"
                  className="w-full bg-[#1a1a1a] hover:bg-[#333] text-white py-6 text-lg font-semibold"
                  onClick={handleSendMagicLink}
                  disabled={sendingMagicLink || magicLinkSent}
                  data-testid="button-send-magic-link"
                >
                  {sendingMagicLink ? "Sending..." : magicLinkSent ? "Link sent!" : "Email me a one-time sign in link"}
                </Button>

                {magicLinkSent && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-center mt-4 p-3 rounded-lg"
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
