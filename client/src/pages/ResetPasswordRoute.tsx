import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useSupabase, usePasswordRecovery } from "@/lib/SupabaseProvider";
import { useToast } from "@/hooks/use-toast";
import PasswordResetScreen from "@/components/PasswordResetScreen";

export default function ResetPasswordRoute() {
  const supabase = useSupabase();
  const { isPasswordRecovery, clearPasswordRecovery } = usePasswordRecovery();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      try {
        console.log("[ResetPassword] Checking recovery state, isPasswordRecovery:", isPasswordRecovery);
        
        if (isPasswordRecovery) {
          console.log("[ResetPassword] Password recovery mode active - showing reset form");
          setIsReady(true);
          setIsProcessing(false);
          return;
        }

        const hash = window.location.hash;
        console.log("[ResetPassword] Hash present:", !!hash, "Hash contents:", hash ? hash.substring(0, 50) + "..." : "none");
        
        if (hash && hash.length > 1) {
          const params = new URLSearchParams(hash.slice(1));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          const type = params.get("type");
          const tokenHash = params.get("token_hash");

          console.log("[ResetPassword] Parsed params - type:", type, "hasAccessToken:", !!accessToken, "hasTokenHash:", !!tokenHash);

          if (tokenHash && type === "recovery") {
            console.log("[ResetPassword] Verifying token_hash for recovery...");
            const { data, error: verifyError } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: "recovery",
            });

            if (verifyError) {
              console.error("[ResetPassword] Token verification error:", verifyError);
              setError("This reset link has expired or is invalid. Please request a new one.");
              setIsProcessing(false);
              return;
            }

            if (data.session) {
              console.log("[ResetPassword] Session established via token_hash");
              window.history.replaceState(null, "", "/reset-password");
              setIsReady(true);
              setIsProcessing(false);
              return;
            }
          }

          if (accessToken) {
            console.log("[ResetPassword] Setting session with access_token...");
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || "",
            });

            if (sessionError) {
              console.error("[ResetPassword] Session error:", sessionError);
              setError("This reset link has expired or is invalid. Please request a new one.");
              setIsProcessing(false);
              return;
            }

            console.log("[ResetPassword] Session established via access_token");
            window.history.replaceState(null, "", "/reset-password");
            setIsReady(true);
            setIsProcessing(false);
            return;
          }
        }

        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          console.log("[ResetPassword] Existing session found - allowing password reset");
          setIsReady(true);
          setIsProcessing(false);
          return;
        }

        console.log("[ResetPassword] No valid recovery method found");
        setError("Invalid reset link. Please request a new password reset.");
        setIsProcessing(false);
      } catch (err) {
        console.error("[ResetPassword] Error:", err);
        setError("Something went wrong. Please try again.");
        setIsProcessing(false);
      }
    };

    const timer = setTimeout(() => {
      initSession();
    }, 100);

    return () => clearTimeout(timer);
  }, [supabase, isPasswordRecovery]);

  const handleSuccess = () => {
    clearPasswordRecovery();
    toast({
      title: "Password updated",
      description: "Your password has been successfully reset. You're now logged in.",
    });
    setLocation("/");
  };

  if (isProcessing) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying your reset link...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6 bg-background">
        <div className="w-full max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4 text-foreground" data-testid="text-error-heading">
            Password Reset Failed
          </h2>
          <p className="text-muted-foreground mb-6" data-testid="text-error-message">
            {error}
          </p>
          <button
            onClick={() => setLocation("/")}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity"
            data-testid="button-go-home"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying your reset link...</p>
        </div>
      </div>
    );
  }

  return <PasswordResetScreen onSuccess={handleSuccess} />;
}
