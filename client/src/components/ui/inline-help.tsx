import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface InlineHelpProps {
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
  "data-testid"?: string;
}

export function InlineHelp({ 
  children, 
  maxWidth = "max-w-xs",
  className,
  "data-testid": testId
}: InlineHelpProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          type="button" 
          className="inline-flex items-center justify-center w-4 h-4 text-xs rounded-full border border-muted-foreground/30 text-muted-foreground hover:bg-muted transition-colors"
          data-testid={testId}
        >
          <Info className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className={cn("text-sm", maxWidth, className)}
        side="top"
        align="start"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
