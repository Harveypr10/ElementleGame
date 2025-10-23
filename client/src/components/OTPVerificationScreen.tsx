import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Mail, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSupabase } from "@/lib/SupabaseProvider";

interface OTPVerificationScreenProps {
  email: string;
  phone?: string;
  type: "signup" | "email_change";
  onVerified: () => void;
  onCancel: () => void;
}

export function OTPVerificationScreen({
  email,
  phone,
  type,
  onVerified,
  onCancel,
}: OTPVerificationScreenProps) {
  const supabase = useSupabase();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(phone || "");
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(15);
  const [loading, setLoading] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<"email" | "sms">("email");

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter a 6-digit code",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: type === "signup" ? "signup" : "email_change",
      });

      if (error) throw error;

      if (data.session) {
        toast({
          title: "Verification successful!",
          description: type === "signup" ? "Your account has been created." : "Your email has been updated.",
        });
        onVerified();
      }
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message || "The code you entered is incorrect or expired",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setLoading(true);
    try {
      if (deliveryMethod === "sms") {
        if (!phoneNumber) {
          toast({
            title: "Phone number required",
            description: "Please enter your phone number to receive SMS codes",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Send OTP via SMS
        const { error } = await supabase.auth.signInWithOtp({
          phone: phoneNumber,
        });

        if (error) throw error;

        toast({
          title: "Code sent!",
          description: `A new verification code has been sent to ${phoneNumber}`,
        });
      } else {
        // Resend OTP via email
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: type === "signup",
          },
        });

        if (error) throw error;

        toast({
          title: "Code sent!",
          description: `A new verification code has been sent to ${email}`,
        });
      }

      setResendCooldown(15);
    } catch (error: any) {
      toast({
        title: "Failed to resend code",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToSMS = () => {
    setShowPhoneInput(!showPhoneInput);
    if (!showPhoneInput) {
      setDeliveryMethod("sms");
    } else {
      setDeliveryMethod("email");
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="w-full max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onCancel}
            data-testid="button-back-from-verification"
            className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="h-9 w-9 text-gray-700" />
          </button>

          <h1 className="text-4xl font-bold text-gray-700">Verify Code</h1>

          <div className="w-14" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Enter Verification Code</CardTitle>
            <CardDescription>
              {deliveryMethod === "email"
                ? `We've sent a 6-digit code to ${email}. Please check your inbox and enter the code below.`
                : `We've sent a 6-digit code to ${phoneNumber}. Please check your messages and enter the code below.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="code" data-testid="label-verification-code">
                Verification Code
              </Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                data-testid="input-verification-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="text-center text-2xl tracking-widest"
              />
            </div>

            {showPhoneInput && (
              <div className="space-y-2">
                <Label htmlFor="phone" data-testid="label-phone-number">
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  data-testid="input-phone-number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1234567890"
                />
                <p className="text-xs text-muted-foreground">
                  Include country code (e.g., +1 for US)
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button
                onClick={handleVerifyCode}
                disabled={loading || code.length !== 6}
                className="w-full"
                data-testid="button-verify-code"
              >
                {loading ? "Verifying..." : "Verify Code"}
              </Button>

              <Button
                variant="outline"
                onClick={handleSwitchToSMS}
                className="w-full"
                data-testid="button-switch-delivery-method"
              >
                {showPhoneInput ? (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Use Email Instead
                  </>
                ) : (
                  <>
                    <Smartphone className="h-4 w-4 mr-2" />
                    Use SMS Instead
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={handleResendCode}
                disabled={resendCooldown > 0 || loading}
                className="w-full"
                data-testid="button-resend-code"
              >
                {resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : "Resend code"}
              </Button>

              <Button
                variant="outline"
                onClick={onCancel}
                className="w-full"
                data-testid="button-cancel-verification"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
