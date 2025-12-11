import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSupabase, usePasswordRecovery } from "@/lib/SupabaseProvider";
import { PasswordInput } from "@/components/ui/password-input";
import { validatePassword, getPasswordRequirementsText } from "@/lib/passwordValidation";

interface PasswordResetScreenProps {
  onSuccess: () => void;
}

export default function PasswordResetScreen({ onSuccess }: PasswordResetScreenProps) {
  const supabase = useSupabase();
  const { clearPasswordRecovery } = usePasswordRecovery();
  const { toast } = useToast();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    requestAnimationFrame(() => {
      setFadeIn(true);
    });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      toast({
        title: "Password required",
        description: "Please enter and confirm your new password.",
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

    setLoading(true);
    
    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      
      // Update password_created in user_profiles
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          await fetch('/api/auth/profile/password-created', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionData.session.access_token}`,
            },
          });
        }
      } catch (err) {
        console.error('[PasswordResetScreen] Error updating password_created:', err);
      }
      
      toast({
        title: "Password updated",
        description: "Your password has been successfully updated.",
      });
      
      clearPasswordRecovery();
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 flex flex-col items-center justify-center px-6"
      style={{ 
        backgroundColor,
        opacity: fadeIn ? 1 : 0,
        transition: 'opacity 0.3s ease-in-out'
      }}
    >
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          <motion.div
            key="password-reset"
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
              Set your new password
            </h2>
            <p 
              className="text-center mb-8"
              style={{ color: secondaryTextColor }}
            >
              Enter your new password below.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label 
                  htmlFor="new-password" 
                  className="text-sm font-medium"
                  style={{ color: textColor }}
                >
                  New Password
                </label>
                <PasswordInput
                  id="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full"
                  data-testid="input-new-password"
                  autoFocus
                />
                <p className="text-xs" style={{ color: secondaryTextColor }}>
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
                  placeholder="Confirm new password"
                  className="w-full"
                  data-testid="input-confirm-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-[#1a1a1a] hover:bg-[#333] text-white py-6 text-lg font-semibold"
                disabled={loading || !password || !confirmPassword}
                data-testid="button-update-password"
              >
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
