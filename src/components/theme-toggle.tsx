"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

/**
 * Light/dark toggle.
 *
 * Both icons are always rendered and CSS decides which is visible, keyed off
 * the `dark` class that next-themes puts on <html> before first paint. That
 * sidesteps the usual hydration problem: the server cannot know which theme
 * the browser will resolve, so *deciding in JavaScript* would mean rendering a
 * guess and correcting it after mount — a mismatch and a visible flicker.
 * Letting CSS choose means there is nothing to guess.
 *
 * Until the user clicks, the app follows the operating system
 * (`defaultTheme="system"` in ThemeProvider). Clicking commits to an explicit
 * light or dark preference, which next-themes persists.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      // resolvedTheme is undefined until mount, but this only runs on click.
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle between light and dark theme"
      title="Toggle theme"
    >
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </Button>
  );
}
