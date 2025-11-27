import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAdBannerActive } from "@/components/AdBanner";
import { useSupabase } from "@/lib/SupabaseProvider";

interface AdminPageProps {
  onBack: () => void;
}

export function AdminPage({ onBack }: AdminPageProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const supabase = useSupabase();
  const adBannerActive = useAdBannerActive();
  const [postcodeRestrictionDays, setPostcodeRestrictionDays] = useState<string>("14");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const accessToken = session?.access_token;
        
        const response = await fetch('/api/admin/settings', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        
        if (response.ok) {
          const settings = await response.json();
          const postcodeSetting = settings.find((s: any) => s.key === 'postcode_restriction_days');
          if (postcodeSetting) {
            setPostcodeRestrictionDays(postcodeSetting.value);
          }
        }
      } catch (error) {
        console.error('Error fetching admin settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [supabase]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const accessToken = session?.access_token;
      
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          key: 'postcode_restriction_days',
          value: postcodeRestrictionDays,
          description: 'Number of days between allowed postcode changes',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save settings');
      }

      toast({
        title: "Settings saved",
        description: "Admin settings have been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const dayOptions = Array.from({ length: 61 }, (_, i) => i);

  return (
    <div className={`min-h-screen flex flex-col p-4 ${adBannerActive ? 'pb-[50px]' : ''}`}>
      <div className="w-full max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            data-testid="button-back-from-admin"
            className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="h-9 w-9 text-gray-700 dark:text-gray-300" />
          </button>

          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-red-500" />
            <h1 className="text-3xl font-bold">Admin</h1>
          </div>

          <div className="w-14" />
        </div>

        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b">
            <Shield className="h-5 w-5 text-red-500" />
            <span className="font-semibold text-red-600 dark:text-red-400">Admin Settings</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <Label htmlFor="postcode-restriction" className="text-base font-semibold">
                  Postcode Change Restriction
                </Label>
                <p className="text-sm text-muted-foreground">
                  Number of days users must wait before changing their postcode again.
                </p>
                <Select
                  value={postcodeRestrictionDays}
                  onValueChange={setPostcodeRestrictionDays}
                >
                  <SelectTrigger id="postcode-restriction" data-testid="select-postcode-days">
                    <SelectValue placeholder="Select days" />
                  </SelectTrigger>
                  <SelectContent>
                    {dayOptions.map((days) => (
                      <SelectItem key={days} value={days.toString()}>
                        {days === 0 ? "No restriction" : `${days} day${days === 1 ? '' : 's'}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Current setting: {postcodeRestrictionDays === "0" 
                    ? "Users can change postcode anytime" 
                    : `Users must wait ${postcodeRestrictionDays} days between changes`}
                </p>
              </div>

              <Button
                className="w-full"
                onClick={handleSave}
                disabled={saving}
                data-testid="button-save-admin-settings"
              >
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </>
          )}
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Changes take effect immediately after saving.
        </p>
      </div>
    </div>
  );
}
