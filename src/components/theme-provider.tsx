"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Theme provider.
 *
 * `next-themes` injects a small blocking script that sets the `class` on
 * <html> before the first paint. That is what prevents the flash of the wrong
 * theme you get from reading localStorage in an effect — the class is already
 * correct by the time anything renders.
 *
 * `attribute="class"` matches how the design system is defined: globals.css
 * declares `@custom-variant dark (&:is(.dark *))`, so a single `dark` class on
 * <html> switches every colour token at once.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      // Follow the operating system until the user expresses a preference.
      defaultTheme="system"
      enableSystem
      // Avoids CSS transitions firing on every colour token mid-switch.
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
