import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Shield, Clock, CalendarClock, Zap, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAdBannerActive } from "@/components/AdBanner";
import { useSupabase } from "@/lib/SupabaseProvider";
import { AdminScreenNavigator } from "@/components/AdminScreenNavigator";

interface AdminPageProps {
  onBack: () => void;
}

interface SchedulerConfig {
  start_time: string;
  frequency_hours: number;
  exists: boolean;
}

interface TierVisibility {
  id: string;
  tier: string;
  tierType: string;
  active: boolean;
  region: string;
}

function calculateNextRunTimes(startTime: string, frequencyHours: number, count: number = 4): Date[] {
  const [hours, minutes] = startTime.split(':').map(Number);
  const now = new Date();
  const runTimes: Date[] = [];
  
  // Calculate all run hours based on start time and frequency
  const runHours: number[] = [];
  let currentHour = hours;
  
  for (let i = 0; i < Math.floor(24 / frequencyHours); i++) {
    runHours.push(currentHour);
    currentHour = (currentHour + frequencyHours) % 24;
  }
  
  runHours.sort((a, b) => a - b);
  
  // Find next run times
  let checkDate = new Date(now);
  checkDate.setSeconds(0, 0);
  
  while (runTimes.length < count) {
    for (const hour of runHours) {
      const runTime = new Date(checkDate);
      runTime.setHours(hour, minutes, 0, 0);
      
      if (runTime > now && runTimes.length < count) {
        runTimes.push(runTime);
      }
    }
    // Move to next day
    checkDate.setDate(checkDate.getDate() + 1);
    checkDate.setHours(0, 0, 0, 0);
  }
  
  return runTimes.slice(0, count);
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export function AdminPage({ onBack }: AdminPageProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const supabase = useSupabase();
  const adBannerActive = useAdBannerActive();
  const [showScreenNavigator, setShowScreenNavigator] = useState(false);
  
  // Postcode/Region restriction state
  const [postcodeRestrictionDays, setPostcodeRestrictionDays] = useState<string>("14");
  
  // Category restriction state (Pro users)
  const [categoryRestrictionDays, setCategoryRestrictionDays] = useState<string>("14");
  
  // Demand scheduler state
  const [schedulerStartTime, setSchedulerStartTime] = useState<string>("01:00");
  const [schedulerFrequency, setSchedulerFrequency] = useState<string>("24");
  const [schedulerConfigExists, setSchedulerConfigExists] = useState(false);
  
  // Tier visibility state
  const [tiers, setTiers] = useState<TierVisibility[]>([]);
  const [tierVisibilityMap, setTierVisibilityMap] = useState<Record<string, boolean>>({});
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingScheduler, setSavingScheduler] = useState(false);
  const [fixingTrigger, setFixingTrigger] = useState(false);
  const [savingTiers, setSavingTiers] = useState(false);

  if (showScreenNavigator) {
    return <AdminScreenNavigator onBack={() => setShowScreenNavigator(false)} />;
  }

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const accessToken = session?.access_token;
        
        // Fetch admin settings, demand scheduler, and tiers in parallel
        const [settingsResponse, schedulerResponse, tiersResponse] = await Promise.all([
          fetch('/api/admin/settings', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }),
          fetch('/api/admin/demand-scheduler', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }),
          fetch('/api/admin/tiers', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }),
        ]);
        
        if (settingsResponse.ok) {
          const settings = await settingsResponse.json();
          const postcodeSetting = settings.find((s: any) => s.key === 'postcode_restriction_days');
          if (postcodeSetting) {
            setPostcodeRestrictionDays(postcodeSetting.value);
          }
          const categorySetting = settings.find((s: any) => s.key === 'category_restriction_days');
          if (categorySetting) {
            setCategoryRestrictionDays(categorySetting.value);
          }
        }
        
        if (schedulerResponse.ok) {
          const schedulerConfig: SchedulerConfig = await schedulerResponse.json();
          setSchedulerStartTime(schedulerConfig.start_time);
          setSchedulerFrequency(schedulerConfig.frequency_hours.toString());
          setSchedulerConfigExists(schedulerConfig.exists);
        }
        
        if (tiersResponse.ok) {
          const tiersData: TierVisibility[] = await tiersResponse.json();
          setTiers(tiersData);
          const visibilityMap: Record<string, boolean> = {};
          tiersData.forEach(t => {
            visibilityMap[t.id] = t.active;
          });
          setTierVisibilityMap(visibilityMap);
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
      
      // Save both settings in parallel
      const [postcodeResponse, categoryResponse] = await Promise.all([
        fetch('/api/admin/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            key: 'postcode_restriction_days',
            value: postcodeRestrictionDays,
            description: 'Number of days between allowed postcode/region changes',
          }),
        }),
        fetch('/api/admin/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            key: 'category_restriction_days',
            value: categoryRestrictionDays,
            description: 'Number of days between allowed category changes (Pro users)',
          }),
        }),
      ]);

      if (!postcodeResponse.ok || !categoryResponse.ok) {
        const errorData = await (postcodeResponse.ok ? categoryResponse : postcodeResponse).json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save settings');
      }

      toast({
        title: "Settings saved",
        description: "Restriction settings have been updated.",
      });
      
      // Also fix the database trigger to respect the new settings
      await handleFixTrigger(false); // Silent update - no separate toast
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
  
  const handleFixTrigger = async (showToast: boolean = true) => {
    setFixingTrigger(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const accessToken = session?.access_token;
      
      const response = await fetch('/api/admin/fix-postcode-trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fix trigger');
      }
      
      if (showToast) {
        toast({
          title: "Trigger updated",
          description: data.message || "Database trigger has been fixed.",
        });
      }
    } catch (error: any) {
      if (showToast) {
        toast({
          title: "Error",
          description: error.message || "Failed to fix trigger. You may need to run the SQL manually in Supabase.",
          variant: "destructive",
        });
      }
      console.error('Error fixing trigger:', error);
    } finally {
      setFixingTrigger(false);
    }
  };

  const handleSaveScheduler = async () => {
    setSavingScheduler(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const accessToken = session?.access_token;
      
      // Save the scheduler config
      const saveResponse = await fetch('/api/admin/demand-scheduler', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          start_time: schedulerStartTime,
          frequency_hours: parseInt(schedulerFrequency, 10),
        }),
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save scheduler config');
      }

      // Apply the new schedule by calling the Edge Function
      const applyResponse = await fetch('/api/admin/demand-scheduler/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!applyResponse.ok) {
        const errorData = await applyResponse.json().catch(() => ({}));
        // Still show success for config save, but warn about apply failure
        toast({
          title: "Config saved, but schedule not applied",
          description: `The config was saved, but the cron job could not be updated: ${errorData.details || errorData.error || 'Unknown error'}`,
          variant: "destructive",
        });
        setSchedulerConfigExists(true);
        return;
      }

      setSchedulerConfigExists(true);
      toast({
        title: "Scheduler updated",
        description: "The demand scheduler has been configured and applied.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save scheduler config",
        variant: "destructive",
      });
    } finally {
      setSavingScheduler(false);
    }
  };

  const handleSaveTierVisibility = async () => {
    setSavingTiers(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const accessToken = session?.access_token;
      
      // Save all tier visibility changes
      const updates = Object.entries(tierVisibilityMap).map(([tierId, active]) => ({
        tierId,
        active,
      }));
      
      const response = await fetch('/api/admin/tiers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save tier visibility');
      }

      toast({
        title: "Tier settings saved",
        description: "Subscription tier visibility has been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save tier settings",
        variant: "destructive",
      });
    } finally {
      setSavingTiers(false);
    }
  };

  // Calculate next run times preview
  const nextRunTimes = useMemo(() => {
    return calculateNextRunTimes(schedulerStartTime, parseInt(schedulerFrequency, 10), 4);
  }, [schedulerStartTime, schedulerFrequency]);

  const dayOptions = Array.from({ length: 61 }, (_, i) => i);
  const frequencyOptions = [
    { value: "6", label: "Every 6 hours" },
    { value: "8", label: "Every 8 hours" },
    { value: "12", label: "Every 12 hours" },
    { value: "24", label: "Every 24 hours (daily)" },
  ];

  return (
    <div className={`min-h-screen flex flex-col p-4 bg-background ${adBannerActive ? 'pb-[50px]' : ''}`}>
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

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <Button
              onClick={() => setShowScreenNavigator(true)}
              variant="outline"
              className="w-full mb-4 justify-start gap-2"
              data-testid="button-screen-navigator"
            >
              <Layers className="h-4 w-4" />
              Screen Navigator (Test Screens)
            </Button>

            {/* Restriction Settings Card */}
            <Card className="p-6 space-y-6">
              <div className="flex items-center gap-2 pb-4 border-b">
                <Shield className="h-5 w-5 text-red-500" />
                <span className="font-semibold text-red-600 dark:text-red-400">Change Restrictions</span>
              </div>

              {/* Postcode/Region Restriction */}
              <div className="space-y-3">
                <Label htmlFor="postcode-restriction" className="text-base font-semibold">
                  Postcode/Region Change Restriction
                </Label>
                <p className="text-sm text-muted-foreground">
                  Number of days users must wait before changing their postcode or region again.
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
                    ? "Users can change postcode/region anytime" 
                    : `Users must wait ${postcodeRestrictionDays} days between changes`}
                </p>
              </div>

              {/* Category Restriction (Pro users) */}
              <div className="space-y-3 pt-4 border-t">
                <Label htmlFor="category-restriction" className="text-base font-semibold">
                  Category Change Restriction (Pro)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Number of days Pro users must wait before changing their category preferences again.
                </p>
                <Select
                  value={categoryRestrictionDays}
                  onValueChange={setCategoryRestrictionDays}
                >
                  <SelectTrigger id="category-restriction" data-testid="select-category-days">
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
                  Current setting: {categoryRestrictionDays === "0" 
                    ? "Pro users can change categories anytime" 
                    : `Pro users must wait ${categoryRestrictionDays} days between changes`}
                </p>
              </div>

              <Button
                className="w-full"
                onClick={handleSave}
                disabled={saving || fixingTrigger}
                data-testid="button-save-admin-settings"
              >
                {saving ? "Saving..." : "Save Restriction Settings"}
              </Button>
              
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">
                  If postcode changes are being blocked by the database, click below to sync the database trigger with the current settings.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleFixTrigger(true)}
                  disabled={fixingTrigger || saving}
                  data-testid="button-fix-trigger"
                >
                  {fixingTrigger ? "Fixing Trigger..." : "Fix Database Trigger"}
                </Button>
              </div>
            </Card>

            {/* Subscription Tier Visibility Card */}
            <Card className="p-6 space-y-6">
              <div className="flex items-center gap-2 pb-4 border-b">
                <Zap className="h-5 w-5 text-purple-500" />
                <span className="font-semibold text-purple-600 dark:text-purple-400">Subscription Tier Visibility</span>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Toggle which subscription tiers are available for purchase. Pro tiers are enabled by default, others are disabled.
                </p>
                
                <div className="space-y-3 max-h-60 overflow-y-auto bg-muted/30 rounded-md p-3">
                  {tiers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No subscription tiers found.</p>
                  ) : (
                    tiers.filter(t => t.tier !== 'Standard').map((tier) => (
                      <div key={tier.id} className="flex items-center justify-between p-3 rounded-md bg-background border">
                        <div className="flex flex-col gap-1 flex-1">
                          <span className="font-medium">{tier.tier}</span>
                          <span className="text-xs text-muted-foreground capitalize">{tier.tierType} • {tier.region}</span>
                        </div>
                        <Switch
                          checked={tierVisibilityMap[tier.id] ?? tier.active}
                          onCheckedChange={(checked) => {
                            setTierVisibilityMap(prev => ({
                              ...prev,
                              [tier.id]: checked,
                            }));
                          }}
                          data-testid={`toggle-tier-${tier.id}`}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleSaveTierVisibility}
                disabled={savingTiers}
                data-testid="button-save-tier-visibility"
              >
                {savingTiers ? "Saving..." : "Save Tier Visibility"}
              </Button>
            </Card>

            {/* Demand Scheduler Card */}
            <Card className="p-6 space-y-6">
              <div className="flex items-center gap-2 pb-4 border-b">
                <CalendarClock className="h-5 w-5 text-blue-500" />
                <span className="font-semibold text-blue-600 dark:text-blue-400">Demand Scheduler</span>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduler-start-time" className="text-base font-semibold">
                    Start Time (24-hour format)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    First scheduled run time of the day.
                  </p>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <Input
                      id="scheduler-start-time"
                      type="time"
                      value={schedulerStartTime}
                      onChange={(e) => setSchedulerStartTime(e.target.value)}
                      className="w-32"
                      data-testid="input-scheduler-start-time"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduler-frequency" className="text-base font-semibold">
                    Frequency
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    How often to run the demand calculation.
                  </p>
                  <Select
                    value={schedulerFrequency}
                    onValueChange={setSchedulerFrequency}
                  >
                    <SelectTrigger id="scheduler-frequency" data-testid="select-scheduler-frequency">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {frequencyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Next Run Times Preview */}
                <div className="space-y-2 pt-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Next Scheduled Runs
                  </Label>
                  <div className="bg-muted/50 rounded-md p-3 space-y-1">
                    {nextRunTimes.map((time, index) => (
                      <div 
                        key={index} 
                        className="text-sm flex items-center gap-2"
                        data-testid={`text-next-run-${index}`}
                      >
                        <span className="text-muted-foreground w-6">{index + 1}.</span>
                        <span className="font-mono">{formatDateTime(time)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {!schedulerConfigExists && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    No scheduler config exists yet. Save to create one.
                  </p>
                )}
              </div>

              <Button
                className="w-full"
                onClick={handleSaveScheduler}
                disabled={savingScheduler}
                data-testid="button-save-scheduler"
              >
                {savingScheduler ? "Applying Schedule..." : "Save & Apply Schedule"}
              </Button>
            </Card>

            <p className="text-xs text-muted-foreground text-center">
              Changes take effect immediately after saving.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
