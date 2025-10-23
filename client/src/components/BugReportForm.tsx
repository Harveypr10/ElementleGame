import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/hooks/useProfile";

interface BugReportFormProps {
  onBack: () => void;
}

export function BugReportForm({ onBack }: BugReportFormProps) {
  const { profile } = useProfile();
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const userEmail = profile?.email || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim()) {
      toast({
        title: "Description required",
        description: "Please describe the bug you encountered",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    // Fallback to mailto: link since email service is not configured
    const subject = `Bug Report - Elementle`;
    const body = `Bug Report from: ${userEmail}\n\nDescription:\n${description}`;
    const mailtoLink = `mailto:no-reply@dobl.uk?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    try {
      // Open mailto link
      window.location.href = mailtoLink;
      
      toast({
        title: "Opening email client",
        description: "Your default email client will open to send the bug report",
      });
      
      // Clear form and return after a delay
      setTimeout(() => {
        setDescription("");
        onBack();
      }, 2000);
    } catch (error) {
      toast({
        title: "Could not open email",
        description: "Please email us directly at no-reply@dobl.uk",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-4 pt-8">
      <div className="w-full max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            data-testid="button-back-from-bug-report"
            className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="h-9 w-9 text-gray-700" />
          </button>

          <h1 className="text-4xl font-bold">Report a Bug</h1>

          <div className="w-14" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Thank you!</CardTitle>
            <CardDescription>
              Your feedback helps us quickly fix issues — please describe what happened
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" data-testid="label-email">Your Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={userEmail}
                  disabled
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" data-testid="label-description">Describe the bug</Label>
                <Textarea
                  id="description"
                  placeholder="What happened? What did you expect to happen? What device and browser are you using?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[150px]"
                  data-testid="textarea-description"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                data-testid="button-send"
              >
                {loading ? "Sending..." : "Send Bug Report"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
