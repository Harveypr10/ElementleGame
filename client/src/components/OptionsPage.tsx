import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserSettings } from "@/hooks/useUserSettings";
import { readLocal, writeLocal, CACHE_KEYS } from "@/lib/localCache";
import { soundManager } from "@/lib/sounds";
import { motion } from "framer-motion";
import { pageVariants, pageTransition } from "@/lib/pageAnimations";

interface OptionsPageProps {
  onBack: () => void;
}

export function OptionsPage({ onBack }: OptionsPageProps) {
  const { isAuthenticated } = useAuth();
  const { settings, updateSettings } = useUserSettings();
  const [textSize, setTextSize] = useState<"small" | "medium" | "large">("medium");
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [cluesEnabled, setCluesEnabled] = useState(true);
  const [digitPreference, setDigitPreference] = useState<"6" | "8">("6");
  const [dateFormatOrder, setDateFormatOrder] = useState<"ddmm" | "mmdd">("ddmm");
  const [useRegionDefault, setUseRegionDefault] = useState(true);

  // Load settings from cache first for instant rendering
  useEffect(() => {
    const cachedSettings = readLocal<any>(CACHE_KEYS.SETTINGS);
    if (cachedSettings) {
      const size = (cachedSettings.textSize as "small" | "medium" | "large") || "medium";
      setTextSize(size);
      const soundsEnabledValue = cachedSettings.soundsEnabled ?? true;
      setSoundsEnabled(soundsEnabledValue);
      soundManager.setEnabled(soundsEnabledValue); // Apply sound setting to manager
      setDarkMode(cachedSettings.darkMode ?? false);
      setCluesEnabled(cachedSettings.cluesEnabled ?? true);
      setDigitPreference(cachedSettings.digitPreference || "6");
      
      // Extract date format order from dateFormatPreference
      const dateFormatPref = cachedSettings.dateFormatPreference || "ddmmyy";
      const order = dateFormatPref.startsWith("dd") ? "ddmm" : "mmdd";
      setDateFormatOrder(order);
      
      setUseRegionDefault(cachedSettings.useRegionDefault ?? true);
      
      // Apply settings to DOM
      document.documentElement.style.setProperty(
        "--text-scale",
        size === "small" ? "0.875" : size === "large" ? "1.125" : "1"
      );
      document.documentElement.classList.toggle("dark", cachedSettings.darkMode ?? false);
    }
  }, []); // Run once on mount

  // Background reconciliation with Supabase or localStorage
  useEffect(() => {
    if (isAuthenticated && settings) {
      // Use Supabase settings for authenticated users
      const size = (settings.textSize as "small" | "medium" | "large") || "medium";
      setTextSize(size);
      const soundsEnabledValue = settings.soundsEnabled ?? true;
      setSoundsEnabled(soundsEnabledValue);
      soundManager.setEnabled(soundsEnabledValue); // Apply sound setting to manager
      setDarkMode(settings.darkMode ?? false);
      setCluesEnabled(settings.cluesEnabled ?? true);
      setDigitPreference((settings.digitPreference as "6" | "8") || "6");
      
      // Extract date format order from dateFormatPreference
      const dateFormatPref = settings.dateFormatPreference || "ddmmyy";
      const order = dateFormatPref.startsWith("dd") ? "ddmm" : "mmdd";
      setDateFormatOrder(order);
      
      setUseRegionDefault(settings.useRegionDefault ?? true);
      
      // Apply settings to DOM
      document.documentElement.style.setProperty(
        "--text-scale",
        size === "small" ? "0.875" : size === "large" ? "1.125" : "1"
      );
      document.documentElement.classList.toggle("dark", settings.darkMode ?? false);
      
      // Update cache
      writeLocal(CACHE_KEYS.SETTINGS, settings);
    } else if (!isAuthenticated) {
      // Use localStorage for guest users
      const storedTheme = localStorage.getItem("theme");
      setDarkMode(storedTheme === "dark");
      
      const storedTextSize = localStorage.getItem("textSize") as "small" | "medium" | "large" | null;
      if (storedTextSize) {
        setTextSize(storedTextSize);
        document.documentElement.style.setProperty(
          "--text-scale",
          storedTextSize === "small" ? "0.875" : storedTextSize === "large" ? "1.125" : "1"
        );
      }
      
      const storedSounds = localStorage.getItem("soundsEnabled");
      const soundsEnabledValue = storedSounds !== null ? storedSounds === "true" : true;
      setSoundsEnabled(soundsEnabledValue);
      soundManager.setEnabled(soundsEnabledValue); // Apply sound setting to manager
      
      const storedClues = localStorage.getItem("cluesEnabled");
      if (storedClues !== null) setCluesEnabled(storedClues === "true");
      
      const storedDigitPref = localStorage.getItem("digitPreference");
      if (storedDigitPref) setDigitPreference(storedDigitPref as "6" | "8");
      
      const storedDateFormatOrder = localStorage.getItem("dateFormatOrder");
      if (storedDateFormatOrder) setDateFormatOrder(storedDateFormatOrder as "ddmm" | "mmdd");
      
      const storedUseRegionDefault = localStorage.getItem("useRegionDefault");
      if (storedUseRegionDefault !== null) setUseRegionDefault(storedUseRegionDefault === "true");
    }
  }, [isAuthenticated, settings]);

  const handleTextSizeChange = async (size: "small" | "medium" | "large") => {
    setTextSize(size);
    document.documentElement.style.setProperty(
      "--text-scale",
      size === "small" ? "0.875" : size === "large" ? "1.125" : "1"
    );
    
    if (isAuthenticated) {
      await updateSettings({ textSize: size });
      // Update cache after Supabase update
      const cachedSettings = readLocal<any>(CACHE_KEYS.SETTINGS) || {};
      writeLocal(CACHE_KEYS.SETTINGS, { ...cachedSettings, textSize: size });
    } else {
      localStorage.setItem("textSize", size);
    }
  };

  const handleDarkModeToggle = async (checked: boolean) => {
    setDarkMode(checked);
    const newTheme = checked ? "dark" : "light";
    document.documentElement.classList.toggle("dark", checked);
    
    if (isAuthenticated) {
      await updateSettings({ darkMode: checked });
      // Update cache after Supabase update
      const cachedSettings = readLocal<any>(CACHE_KEYS.SETTINGS) || {};
      writeLocal(CACHE_KEYS.SETTINGS, { ...cachedSettings, darkMode: checked });
    } else {
      localStorage.setItem("theme", newTheme);
    }
  };

  const handleSoundsToggle = async (checked: boolean) => {
    setSoundsEnabled(checked);
    soundManager.setEnabled(checked); // Actually enable/disable the sound manager
    
    if (isAuthenticated) {
      await updateSettings({ soundsEnabled: checked });
      // Update cache after Supabase update
      const cachedSettings = readLocal<any>(CACHE_KEYS.SETTINGS) || {};
      writeLocal(CACHE_KEYS.SETTINGS, { ...cachedSettings, soundsEnabled: checked });
    } else {
      localStorage.setItem("soundsEnabled", String(checked));
    }
  };

  const handleCluesToggle = async (checked: boolean) => {
    setCluesEnabled(checked);
    
    if (isAuthenticated) {
      await updateSettings({ cluesEnabled: checked });
      // Update cache after Supabase update
      const cachedSettings = readLocal<any>(CACHE_KEYS.SETTINGS) || {};
      writeLocal(CACHE_KEYS.SETTINGS, { ...cachedSettings, cluesEnabled: checked });
    } else {
      localStorage.setItem("cluesEnabled", String(checked));
    }
  };

  const handleDigitPreferenceChange = async (value: "6" | "8") => {
    setDigitPreference(value);
    
    // Build the full dateFormatPreference based on order and digit count
    const suffix = value === "6" ? "yy" : "yyyy";
    const fullFormat = dateFormatOrder === "ddmm" ? `dd/mm/${suffix}` : `mm/dd/${suffix}`;
    const dbFormat = fullFormat.replace(/\//g, ''); // Remove slashes for DB: ddmmyy, mmddyy, ddmmyyyy, mmddyyyy
    
    // When user explicitly changes digit preference, disable region default
    setUseRegionDefault(false);
    
    if (isAuthenticated) {
      await updateSettings({ 
        digitPreference: value,
        dateFormatPreference: dbFormat,
        useRegionDefault: false
      });
      // Update cache after Supabase update
      const cachedSettings = readLocal<any>(CACHE_KEYS.SETTINGS) || {};
      writeLocal(CACHE_KEYS.SETTINGS, { ...cachedSettings, digitPreference: value, dateFormatPreference: dbFormat, useRegionDefault: false });
    } else {
      localStorage.setItem("digitPreference", value);
      localStorage.setItem("dateFormatOrder", dateFormatOrder);
      localStorage.setItem("useRegionDefault", "false");
    }
  };

  const handleDateFormatOrderChange = async (value: "ddmm" | "mmdd") => {
    setDateFormatOrder(value);
    
    // Build the full dateFormatPreference based on order and digit count
    const suffix = digitPreference === "6" ? "yy" : "yyyy";
    const fullFormat = value === "ddmm" ? `dd/mm/${suffix}` : `mm/dd/${suffix}`;
    const dbFormat = fullFormat.replace(/\//g, ''); // Remove slashes for DB: ddmmyy, mmddyy, ddmmyyyy, mmddyyyy
    
    // When user explicitly changes date format order, disable region default
    setUseRegionDefault(false);
    
    if (isAuthenticated) {
      await updateSettings({ 
        dateFormatPreference: dbFormat,
        useRegionDefault: false
      });
      // Update cache after Supabase update
      const cachedSettings = readLocal<any>(CACHE_KEYS.SETTINGS) || {};
      writeLocal(CACHE_KEYS.SETTINGS, { ...cachedSettings, dateFormatPreference: dbFormat, useRegionDefault: false });
    } else {
      localStorage.setItem("dateFormatOrder", value);
      localStorage.setItem("useRegionDefault", "false");
    }
  };

  const handleUseRegionDefaultToggle = async (checked: boolean) => {
    setUseRegionDefault(checked);
    
    if (isAuthenticated) {
      await updateSettings({ useRegionDefault: checked });
      // Update cache after Supabase update
      const cachedSettings = readLocal<any>(CACHE_KEYS.SETTINGS) || {};
      writeLocal(CACHE_KEYS.SETTINGS, { ...cachedSettings, useRegionDefault: checked });
    } else {
      localStorage.setItem("useRegionDefault", String(checked));
    }
  };

  return (
    <motion.div 
      className="min-h-screen flex flex-col p-4"
      initial={pageVariants.slideRight.initial}
      animate={pageVariants.slideRight.animate}
      exit={pageVariants.slideRight.exit}
      transition={pageTransition}
    >
      <div className="w-full max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            data-testid="button-back-from-options"
            className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="h-9 w-9 text-gray-700" />
          </button>

          <h1 className="text-4xl font-bold">Options</h1>

          <div className="w-14" />
        </div>

        <Card className="p-6 space-y-6">
          <div className="space-y-4">
            <Label className="text-base font-semibold">Text Size</Label>
            <div className="flex gap-2">
              {(["small", "medium", "large"] as const).map((size) => (
                <Button
                  key={size}
                  variant={textSize === size ? "default" : "outline"}
                  onClick={() => handleTextSizeChange(size)}
                  className="flex-1"
                  data-testid={`button-text-size-${size}`}
                >
                  {size.charAt(0).toUpperCase() + size.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sounds" className="text-base">
                Sounds
              </Label>
              <p className="text-sm text-muted-foreground">
                Play sound effects
              </p>
            </div>
            <Switch
              id="sounds"
              checked={soundsEnabled}
              onCheckedChange={handleSoundsToggle}
              data-testid="switch-sounds"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="darkMode" className="text-base">
                Dark Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Toggle dark theme
              </p>
            </div>
            <Switch
              id="darkMode"
              checked={darkMode}
              onCheckedChange={handleDarkModeToggle}
              data-testid="switch-dark-mode"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="clues" className="text-base">
                Clues
              </Label>
              <p className="text-sm text-muted-foreground">
                Show the event title when guessing
              </p>
            </div>
            <Switch
              id="clues"
              checked={cluesEnabled}
              onCheckedChange={handleCluesToggle}
              data-testid="switch-clues"
            />
          </div>

          <div className="space-y-4">
            <Label className="text-base font-semibold">Date Format</Label>
            <div className="flex gap-2">
              {(["6", "8"] as const).map((digits) => (
                <Button
                  key={digits}
                  variant={digitPreference === digits ? "default" : "outline"}
                  onClick={() => handleDigitPreferenceChange(digits)}
                  className="flex-1"
                  data-testid={`button-digit-${digits}`}
                >
                  {digits} Digits
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Choose between 6-digit or 8-digit date format
            </p>
            
            <div className="flex gap-2 mt-4">
              {(["ddmm", "mmdd"] as const).map((order) => (
                <Button
                  key={order}
                  variant={dateFormatOrder === order ? "default" : "outline"}
                  onClick={() => handleDateFormatOrderChange(order)}
                  className="flex-1"
                  data-testid={`button-date-order-${order}`}
                >
                  {order === "ddmm" ? "DD/MM/YY" : "MM/DD/YY"}
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Choose date format order
            </p>
          </div>
        </Card>

        {!isAuthenticated && (
          <p className="text-sm text-muted-foreground text-center">
            Sign in to sync your settings across devices
          </p>
        )}
      </div>
    </motion.div>
  );
}
