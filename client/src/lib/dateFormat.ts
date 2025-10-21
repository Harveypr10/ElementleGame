export function formatDateWithOrdinal(dateString: string): string {
  // Parse date in DDMMYY format
  const day = parseInt(dateString.slice(0, 2), 10);
  const month = parseInt(dateString.slice(2, 4), 10) - 1; // 0-indexed
  const year = parseInt(dateString.slice(4, 6), 10);
  
  // Determine century (assume 20th century for years >= 50, 21st otherwise)
  const fullYear = year >= 50 ? 1900 + year : 2000 + year;
  
  // Get month name
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  // Get ordinal suffix
  const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return "th";
    switch (day % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  };
  
  const ordinalDay = `${day}${getOrdinalSuffix(day)}`;
  const monthName = monthNames[month];
  
  return `${ordinalDay} ${monthName} ${fullYear}`;
}

export function formatFullDateWithOrdinal(dateString: string): string {
  // Parse date in DD/MM/YYYY format
  const parts = dateString.split('/');
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed
  const year = parseInt(parts[2], 10);
  
  // Get month name
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  // Get ordinal suffix
  const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return "th";
    switch (day % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  };
  
  const ordinalDay = `${day}${getOrdinalSuffix(day)}`;
  const monthName = monthNames[month];
  
  return `${ordinalDay} ${monthName} ${year}`;
}

// Convert an ISO date (YYYY-MM-DD) into DD/MM/YYYY for formatFullDateWithOrdinal
export function isoToDisplayDate(isoString: string): string {
  const [year, month, day] = isoString.split("-");
  return `${day}/${month}/${year}`;
}

export function formatIsoDateWithOrdinal(isoString: string): string {
  // Expecting YYYY-MM-DD
  const [year, month, day] = isoString.split("-");
  const d = parseInt(day, 10);
  const m = parseInt(month, 10) - 1;
  const y = parseInt(year, 10);

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  const getOrdinalSuffix = (n: number): string => {
    if (n > 3 && n < 21) return "th";
    switch (n % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  };

  return `${d}${getOrdinalSuffix(d)} ${monthNames[m]} ${y}`;
}
