// src/lib/RoutePersistence.tsx
import { useEffect } from "react";
import { useLocation } from "wouter";

export function RoutePersistence() {
  const [location, setLocation] = useLocation();

  // Save route whenever it changes
  useEffect(() => {
    localStorage.setItem("last-route", location);
  }, [location]);

  // On first mount, restore last route if different
  useEffect(() => {
    const last = localStorage.getItem("last-route");
    if (last && last !== location) {
      setLocation(last);
    }
  }, []); // run once on mount

  return null;
}
