import { useState, useEffect, useRef } from "react";
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

// Helper: Normalize postcode format (uppercase, canonical spacing)
function normalizePostcode(input: string, canonicalFormat?: string): string {
  const clean = input.replace(/\s/g, "").toUpperCase();
  if (canonicalFormat) {
    const cleanCanonical = canonicalFormat.replace(/\s/g, "").toUpperCase();
    if (clean === cleanCanonical) {
      return canonicalFormat;
    }
  }
  return clean;
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
  const [previewText, setPreviewText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const blurTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);
  const isFocusedRef = useRef(false);

  // Compute ONLY the remaining characters for grey preview
  const updatePreview = (currentValue: string, suggestionsList: string[]) => {
    if (!currentValue || suggestionsList.length === 0) {
      setPreviewText("");
      return;
    }
    const firstMatch = suggestionsList[0];
    const cleanValue = currentValue.replace(/\s/g, "").toUpperCase();
    const cleanMatch = firstMatch.replace(/\s/g, "").toUpperCase();
    if (cleanMatch.startsWith(cleanValue)) {
      setPreviewText(firstMatch);
    } else {
      setPreviewText("");
    }
  };

  // Fetch suggestions from Postcodes.io
  const fetchSuggestions = async (input: string) => {
    const cleanInput = input.replace(/\s/g, "").toUpperCase();
    if (!cleanInput || cleanInput.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      setValidPostcodes(new Set());
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `https://api.postcodes.io/postcodes?q=${encodeURIComponent(cleanInput)}`
      );
      const data = await res.json();

      if (data.result) {
        const postcodes = data.result.slice(0, 20).map((r: any) => r.postcode);
        setSuggestions(postcodes);
        setValidPostcodes(new Set(postcodes));
        setShowSuggestions(isFocusedRef.current && postcodes.length > 0);
        updatePreview(input, postcodes);
      } else {
        setSuggestions([]);
        setValidPostcodes(new Set());
        setShowSuggestions(false);
        setPreviewText("");
      }
    } catch (error) {
      console.error("Error fetching postcodes:", error);
      setSuggestions([]);
      setValidPostcodes(new Set());
      setShowSuggestions(false);
      setPreviewText("");
    } finally {
      setLoading(false);
    }
  };


  // Validate a specific postcode value (space-insensitive) using Postcodes.io
  const validatePostcode = async (postcodeValue: string): Promise<boolean> => {
    if (!postcodeValue || postcodeValue.length < 2) {
      return true; // Empty or too short is acceptable (not invalid)
    }

    try {
      const cleanValue = postcodeValue.replace(/\s/g, "").toUpperCase();

      // Call Postcodes.io to validate
      const res = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(cleanValue)}`
      );
      const data = await res.json();

      // Postcodes.io returns { status: 200, result: {...} } if valid
      return data && data.status === 200 && !!data.result;
    } catch (error) {
      console.error("Error validating postcode:", error);
      return false;
    }
  };

  // Debounced search
  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    setSelectedIndex(-1);
    setPreviewText(""); // Clear preview while typing

    // Reset validation state while typing (user is still editing)
    if (newValue) {
      setIsValid(true);
      setErrorMessage("");
    } else {
      // Empty is valid
      setIsValid(true);
      setErrorMessage("");
      setPreviewText("");
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
    setErrorMessage("");
    setPreviewText("");
  };

  // Auto-complete with preview or validate on blur
  const handleBlur = () => {
    isFocusedRef.current = false;

    // Clear any existing blur timer
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
    }

    blurTimerRef.current = setTimeout(async () => {
      if (isFocusedRef.current) {
        return;
      }

      setShowSuggestions(false);
      setSelectedIndex(-1);

      const currentValue = inputRef.current?.value || "";

      if (!currentValue) {
        setIsValid(true);
        setErrorMessage("");
        setPreviewText("");
        return;
      }

      // If there's a preview, auto-commit it
      if (previewText && currentValue) {
        const cleanValue = currentValue.replace(/\s/g, "").toUpperCase();
        const cleanPreview = previewText.replace(/\s/g, "").toUpperCase();

        if (cleanPreview.startsWith(cleanValue)) {
          onChange(previewText);
          setIsValid(true);
          setErrorMessage("");
          setPreviewText("");
          return;
        }
      }

      // Check against cached valid postcodes first
      const cleanCurrent = currentValue.replace(/\s/g, "").toUpperCase();
      const matchedPostcode = Array.from(validPostcodes).find(
        (pc) => pc.replace(/\s/g, "").toUpperCase() === cleanCurrent
      );

      if (matchedPostcode) {
        onChange(matchedPostcode);
        setIsValid(true);
        setErrorMessage("");
        setPreviewText("");
        return;
      }

      // If not in cache, query Postcodes.io to verify
      const isValid = await validatePostcode(currentValue);

      if (isFocusedRef.current || inputRef.current?.value !== currentValue) {
        return; // User refocused or value changed while validating - abort
      }

      if (isValid) {
        setIsValid(true);
        setErrorMessage("");
        setPreviewText("");
      } else {
        setIsValid(false);
        setErrorMessage("Invalid postcode - Postcode must be valid to continue.");
        onChange("");
        setPreviewText("");
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
      // Validate prefilled values using Postcodes.io
      validatePostcode(value).then((isValid) => {
        setIsValid(isValid);
      });
    }
  }, [value]);

  // Handle keyboard navigation and Tab completion
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Tab key: auto-complete with preview
    if (e.key === "Tab" && previewText && value) {
      e.preventDefault();
      selectSuggestion(previewText);
      return;
    }

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
      setPreviewText("");
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
            !isValid && "border-destructive focus-visible:ring-destructive"
          )}
          required={required}
          data-testid={testId}
          autoComplete="off"
        />

        {/* Grey preview text overlay */}
        {previewText && value && (() => {
          const cleanValue = value.replace(/\s/g, "").toUpperCase();
          const cleanPreview = previewText.replace(/\s/g, "").toUpperCase();

          if (cleanPreview.startsWith(cleanValue)) {
            // Find where user's input ends in the preview (with spaces)
            let charCount = 0;
            let previewIndex = 0;
            while (charCount < cleanValue.length && previewIndex < previewText.length) {
              if (previewText[previewIndex] !== " ") {
                charCount++;
              }
              previewIndex++;
            }

            const remaining = previewText.slice(previewIndex);

            return (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex text-sm">
                <span className="opacity-0">{value}</span>
                <span className="text-muted-foreground/40">{remaining}</span>
              </div>
            );
          }
          return null;
        })()}

        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {errorMessage && (
        <p
          className="text-xs text-destructive mt-1"
          data-testid={`${testId}-error`}
        >
          {errorMessage}
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

