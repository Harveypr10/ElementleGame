import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Mail, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSupabase } from "@/lib/SupabaseProvider";

// Common country codes for phone numbers
const COUNTRY_CODES = [
  { code: "+44", name: "United Kingdom", flag: "🇬🇧" },
  { code: "+1", name: "United States/Canada", flag: "🇺🇸" },
  { code: "+33", name: "France", flag: "🇫🇷" },
  { code: "+49", name: "Germany", flag: "🇩🇪" },
  { code: "+34", name: "Spain", flag: "🇪🇸" },
  { code: "+39", name: "Italy", flag: "🇮🇹" },
  { code: "+61", name: "Australia", flag: "🇦🇺" },
  { code: "+91", name: "India", flag: "🇮🇳" },
  { code: "+86", name: "China", flag: "🇨🇳" },
  { code: "+81", name: "Japan", flag: "🇯🇵" },
];

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
  
  // Parse existing phone number if provided (E.164 format: +CountryCode LocalNumber)
  const parsePhoneNumber = (fullPhone: string) => {
    if (!fullPhone) return { code: "+44", local: "" };
    
    // If already in E.164 format (starts with +)
    if (fullPhone.startsWith("+")) {
      // Try to match against known country codes
      for (const country of COUNTRY_CODES) {
        if (fullPhone.startsWith(country.code)) {
          return {
            code: country.code,
            local: fullPhone.slice(country.code.length),
          };
        }
      }
      
      // If no match found in known codes, extract country code dynamically
      // Country codes are 1-3 digits after the +
      const match = fullPhone.match(/^(\+\d{1,3})(\d+)$/);
      if (match) {
        return {
          code: match[1], // Extracted country code (e.g., "+353")
          local: match[2], // Remaining digits
        };
      }
      
      // Fallback: treat entire number as local (shouldn't happen with valid E.164)
      return { code: "+44", local: fullPhone.slice(1) };
    }
    
    // Otherwise, treat as local number with UK default
    return { code: "+44", local: fullPhone };
  };
  
  const { code: initialCode, local: initialLocal } = parsePhoneNumber(phone || "");
  const [phoneNumber, setPhoneNumber] = useState(initialLocal);
  const [countryCode, setCountryCode] = useState(initialCode);
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
      // For signInWithOtp-based signup, use 'email' type instead of 'signup'
      const verifyType = type === "signup" ? "email" : "email_change";
      console.log('[OTP] Verifying OTP with type:', verifyType);
      
      const { data, error} = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "magiclink",
      });

      console.log('[OTP] verifyOtp result:', error ? `Error: ${error.message}` : 'Success');
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

        // Combine country code with phone number (remove any leading zeros from local number)
        const cleanNumber = phoneNumber.replace(/^0+/, ''); // Remove leading zeros
        const fullPhoneNumber = `${countryCode}${cleanNumber}`;

        // Send OTP via SMS
        const { error } = await supabase.auth.signInWithOtp({
          phone: fullPhoneNumber,
        });

        if (error) throw error;

        toast({
          title: "Code sent!",
          description: `A new verification code has been sent to ${fullPhoneNumber}`,
        });
      } else {
        // Resend OTP via email
        console.log('[OTP] Resending OTP via email, shouldCreateUser:', type === "signup");
        
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: type === "signup",
          },
        });

        console.log('[OTP] Resend result:', error ? `Error: ${error.message}` : 'Success');
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
    <div className="min-h-screen flex flex-col p-4 pt-8">
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
                : `We've sent a 6-digit code to ${countryCode}${phoneNumber.replace(/^0+/, '')}. Please check your messages and enter the code below.`}
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
                <Label htmlFor="country-code" data-testid="label-country-code">
                  Country
                </Label>
                <Select
                  value={countryCode}
                  onValueChange={setCountryCode}
                >
                  <SelectTrigger
                    id="country-code"
                    data-testid="select-country-code"
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_CODES.map((country) => (
                      <SelectItem
                        key={country.code}
                        value={country.code}
                        data-testid={`option-country-${country.code}`}
                      >
                        {country.flag} {country.name} ({country.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Label htmlFor="phone" data-testid="label-phone-number">
                  Phone Number
                </Label>
                <div className="flex gap-2">
                  <div className="flex items-center justify-center px-3 border rounded-md bg-muted text-muted-foreground">
                    {countryCode}
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    data-testid="input-phone-number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                    placeholder="7700900000"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter your local number without the country code. For UK numbers, omit the leading 0.
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
