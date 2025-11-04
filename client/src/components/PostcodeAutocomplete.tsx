import { useState, useEffect, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface PostcodeAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  "data-testid"?: string;
}

export function PostcodeAutocomplete({
  value,
  onChange,
  placeholder = "Enter postcode",
  className,
  required = false,
  "data-testid": testId,
}: PostcodeAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [validPostcodes, setValidPostcodes] = useState<Set<string>>(new Set());
  const [isValid, setIsValid] = useState(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const blurTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);
  const isFocusedRef = useRef(false);

  // Fetch suggestions from Supabase
  const fetchSuggestions = async (input: string) => {
    if (!input || input.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setValidPostcodes(new Set());
      return;
    }

    setLoading(true);
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from("postcodes")
        .select("name1")
        .ilike("name1", `${input.toUpperCase()}%`)
        .limit(20);

      if (!error && data) {
        const postcodes = data.map((row) => row.name1);
        setSuggestions(postcodes);
        setValidPostcodes(new Set(postcodes));
        // Only show suggestions if input is still focused
        setShowSuggestions(isFocusedRef.current && data.length > 0);
      } else {
        setSuggestions([]);
        setValidPostcodes(new Set());
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error("Error fetching postcodes:", error);
      setSuggestions([]);
      setValidPostcodes(new Set());
      setShowSuggestions(false);
    } finally {
      setLoading(false);
    }
  };

  // Validate a specific postcode value
  const validatePostcode = async (postcodeValue: string): Promise<boolean> => {
    if (!postcodeValue || postcodeValue.length < 2) {
      return true; // Empty or too short is acceptable (not invalid)
    }

    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from("postcodes")
        .select("name1")
        .eq("name1", postcodeValue.toUpperCase())
        .single();

      return !error && !!data;
    } catch (error) {
      console.error("Error validating postcode:", error);
      return false;
    }
  };

  // Debounced search
  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    setSelectedIndex(-1);
    
    // Reset validation state while typing (user is still editing)
    if (newValue) {
      setIsValid(true);
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer (300ms debounce)
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  // Handle suggestion selection
  const selectSuggestion = (suggestion: string) => {
    // Cancel any pending blur validation since we're selecting a valid value
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    
    onChange(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    setIsValid(true);
  };

  // Validate postcode on blur
  const handleBlur = () => {
    isFocusedRef.current = false;
    
    // Clear any existing blur timer
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
    }
    
    blurTimerRef.current = setTimeout(async () => {
      // Double-check that input is still blurred before validating
      if (isFocusedRef.current) {
        return;
      }
      
      setShowSuggestions(false);
      setSelectedIndex(-1);
      
      // Read current value from input (not closure)
      const valueToValidate = inputRef.current?.value || "";
      
      if (!valueToValidate || valueToValidate.length < 2) {
        setIsValid(true);
        return;
      }

      // Check against cached valid postcodes first
      if (validPostcodes.has(valueToValidate)) {
        setIsValid(true);
        return;
      }

      // If not in cache, query database to verify
      const isValid = await validatePostcode(valueToValidate);
      
      // Before applying results, verify field is still blurred and value hasn't changed
      if (isFocusedRef.current || inputRef.current?.value !== valueToValidate) {
        return; // User refocused or value changed while validating - abort
      }
      
      setIsValid(isValid);
      
      // If invalid, clear the value to enforce selection
      if (!isValid) {
        onChange("");
      }
    }, 200);
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
    
    // Cancel any pending blur validation since input regained focus
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  // Validate when value prop changes (e.g., prefilled data)
  useEffect(() => {
    if (value && value.length >= 2 && validPostcodes.size === 0) {
      // Validate prefilled values
      validatePostcode(value).then((isValid) => {
        setIsValid(isValid);
      });
    }
  }, [value]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const selectedItem = suggestionsRef.current.children[selectedIndex] as HTMLElement;
      selectedItem?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        suggestionsRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={cn(
            className,
            !isValid && value && "border-destructive focus-visible:ring-destructive"
          )}
          required={required}
          data-testid={testId}
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {!isValid && !value && (
        <p className="text-xs text-destructive mt-1" data-testid={`${testId}-error`}>
          Invalid postcode. Please select from the dropdown.
        </p>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <ul
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
          data-testid={`${testId}-suggestions`}
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              onClick={() => selectSuggestion(suggestion)}
              className={cn(
                "px-3 py-2 cursor-pointer text-sm hover-elevate",
                selectedIndex === index && "bg-accent text-accent-foreground"
              )}
              data-testid={`${testId}-suggestion-${index}`}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
