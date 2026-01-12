import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useSupabase } from "@/lib/SupabaseProvider";
import { useToast } from "@/hooks/use-toast";
import PasswordResetScreen from "@/components/PasswordResetScreen";

export default function ResetPasswordRoute() {
  const supabase = useSupabase();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initSession = async () => {
      try {
        const hash = window.location.hash;
        if (!hash) {
          setError("Invalid reset link. Please request a new password reset.");
          return;
        }

        const params = new URLSearchParams(hash.slice(1));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const type = params.get("type");

        if (type !== "recovery" || !accessToken) {
          setError("Invalid reset link. Please request a new password reset.");
          return;
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || "",
        });

        if (sessionError) {
          console.error("[ResetPassword] Session error:", sessionError);
          setError("This reset link has expired or is invalid. Please request a new one.");
          return;
        }

        window.history.replaceState(null, "", "/reset-password");
        setIsReady(true);
      } catch (err) {
        console.error("[ResetPassword] Error:", err);
        setError("Something went wrong. Please try again.");
      }
    };

    initSession();
  }, [supabase]);

  const handleSuccess = () => {
    toast({
      title: "Password updated",
      description: "Your password has been successfully reset. You're now logged in.",
    });
    setLocation("/");
  };

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
