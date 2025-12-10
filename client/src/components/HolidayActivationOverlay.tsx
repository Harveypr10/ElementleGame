import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface HolidayActivationOverlayProps {
  show: boolean;
  regionHolidayDates: string[];
  userHolidayDates: string[];
  showUserAfterRegion: boolean;
  holidayDurationDays: number;
  onComplete: () => void;
}

export function HolidayActivationOverlay({
  show,
  regionHolidayDates,
  userHolidayDates,
  showUserAfterRegion,
  holidayDurationDays,
  onComplete,
}: HolidayActivationOverlayProps) {
  const [overlayMode, setOverlayMode] = useState<'region' | 'user'>('region');
  const [phase, setPhase] = useState<'fade-in' | 'glow' | 'fade-out'>('fade-in');
  const [shouldShowUserAfter, setShouldShowUserAfter] = useState(false);

  useEffect(() => {
    if (show) {
      const hasRegion = regionHolidayDates.length > 0;
      const hasUser = userHolidayDates.length > 0;
      
      if (hasRegion) {
        setOverlayMode('region');
        setShouldShowUserAfter(showUserAfterRegion && hasUser);
      } else if (hasUser) {
        setOverlayMode('user');
        setShouldShowUserAfter(false);
      }
      setPhase('fade-in');
    }
  }, [show, regionHolidayDates, userHolidayDates, showUserAfterRegion]);

  useEffect(() => {
    if (!show) return;
    
    let timer: NodeJS.Timeout;
    
    if (phase === 'fade-in') {
      timer = setTimeout(() => setPhase('glow'), 1000);
    } else if (phase === 'glow') {
      timer = setTimeout(() => setPhase('fade-out'), 3000);
    } else if (phase === 'fade-out') {
      timer = setTimeout(() => {
        if (overlayMode === 'region' && shouldShowUserAfter) {
          setOverlayMode('user');
          setShouldShowUserAfter(false);
          setPhase('fade-in');
        } else {
          onComplete();
        }
      }, 1000);
    }
    
    return () => clearTimeout(timer);
  }, [show, phase, overlayMode, shouldShowUserAfter, onComplete]);

  const today = new Date();
  const currentMonth = today.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const currentDay = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const currentHolidayDates = overlayMode === 'region' ? regionHolidayDates : userHolidayDates;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 'fade-out' ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
        >
          <motion.div
            className="bg-card rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: phase === 'fade-out' ? 0 : 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className={cn(
                "p-2 rounded-full",
                overlayMode === 'region' 
                  ? "bg-blue-100 dark:bg-blue-900/30" 
                  : "bg-purple-100 dark:bg-purple-900/30"
              )}>
                {overlayMode === 'region' ? (
                  <Globe className="h-5 w-5 text-blue-500" />
                ) : (
                  <User className="h-5 w-5 text-purple-500" />
                )}
              </div>
              <h3 className="text-lg font-semibold">
                {overlayMode === 'region' ? 'Global Game' : 'Personal Game'}
              </h3>
            </div>

            <p className="text-center text-sm text-muted-foreground mb-4">
              Holiday mode is now active
            </p>

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-center text-sm font-medium mb-3">{currentMonth}</p>
              
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                  <div key={i} className="text-center text-xs text-muted-foreground font-medium">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: adjustedFirstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const isToday = day === currentDay;
                  
                  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isHolidayDate = currentHolidayDates.includes(dateStr);
                  
                  return (
                    <div
                      key={day}
                      className={cn(
                        "aspect-square flex items-center justify-center text-xs rounded-md relative",
                        (isToday || isHolidayDate) && "font-bold"
                      )}
                    >
                      {isHolidayDate && phase === 'glow' && (
                        <motion.div
                          className="absolute inset-0 rounded-md border-2 border-yellow-400"
                          initial={{ opacity: 0 }}
                          animate={{
                            opacity: 1,
                            boxShadow: [
                              "0 0 5px 2px rgba(250, 204, 21, 0.4)",
                              "0 0 15px 5px rgba(250, 204, 21, 0.7)",
                              "0 0 5px 2px rgba(250, 204, 21, 0.4)",
                            ],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                        />
                      )}
                      <span className={cn(isHolidayDate && phase === 'glow' && "relative z-10")}>{day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
