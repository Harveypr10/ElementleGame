import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface AuthPageProps {
  mode: "login" | "signup";
  onSuccess: () => void;
  onSwitchMode: () => void;
  onBack: () => void;
}

export default function AuthPage({ mode, onSuccess, onSwitchMode, onBack }: AuthPageProps) {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        await signUp(formData.email, formData.password, formData.firstName, formData.lastName);
        toast({
          title: "Account created!",
          description: "Welcome to Elementle!",
        });
      } else {
        await signIn(formData.email, formData.password);
        toast({
          title: "Welcome back!",
          description: "You've successfully signed in.",
        });
      }
      onSuccess();
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
              <Input
                id="password"
                type="password"
                data-testid="input-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>

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
