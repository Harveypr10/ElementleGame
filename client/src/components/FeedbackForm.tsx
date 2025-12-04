import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/hooks/useProfile";
import { useAdBannerActive } from "@/components/AdBanner";

interface FeedbackFormProps {
  onBack: () => void;
}

export function FeedbackForm({ onBack }: FeedbackFormProps) {
  const { profile } = useProfile();
  const { toast } = useToast();
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const adBannerActive = useAdBannerActive();

  const userEmail = profile?.email || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedback.trim()) {
      toast({
        title: "Feedback required",
        description: "Please share your thoughts with us",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    // Fallback to mailto: link since email service is not configured
    const subject = `Feedback - Elementle`;
    const ratingText = rating > 0 ? `Rating: ${rating}/5 stars\n\n` : '';
    const body = `Feedback from: ${userEmail}\n\n${ratingText}Feedback:\n${feedback}`;
    const mailtoLink = `mailto:no-reply@dobl.uk?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    try {
      // Open mailto link
      window.location.href = mailtoLink;
      
      toast({
        title: "Opening email client",
        description: "Your default email client will open to send your feedback",
      });
      
      // Clear form and return after a delay
      setTimeout(() => {
        setFeedback("");
        setRating(0);
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
    <div className={`min-h-screen flex flex-col p-4 bg-background pt-8 ${adBannerActive ? 'pb-[50px]' : ''}`}>
      <div className="w-full max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            data-testid="button-back-from-feedback"
            className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="h-9 w-9 text-gray-700" />
          </button>

          <h1 className="text-4xl font-bold">Feedback</h1>

          <div className="w-14" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>How are we doing?</CardTitle>
            <CardDescription>
              Tell us what you enjoy and how we can make Elementle even better
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
                <Label htmlFor="feedback" data-testid="label-feedback">Your Feedback</Label>
                <Textarea
                  id="feedback"
                  placeholder="What do you think about Elementle?"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="min-h-[150px]"
                  data-testid="textarea-feedback"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label data-testid="label-rating">Do you like playing Elementle?</Label>
                <div className="flex gap-2 justify-center py-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="transition-all hover:scale-110"
                      data-testid={`button-star-${star}`}
                    >
                      <Star
                        className={`h-10 w-10 ${
                          star <= rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                data-testid="button-send"
              >
                {loading ? "Sending..." : "Send Feedback"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
