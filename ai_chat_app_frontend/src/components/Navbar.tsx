import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, Moon, Sun } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarTrigger } from "./ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import AuthModal from "./AuthModal";
import { useQuery } from "@tanstack/react-query";
import { getHealth } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const [darkMode, setDarkMode] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | null>(null);
  const { user, signOut } = useAuth();
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    staleTime: 5 * 60_000,
    retry: false,
  });

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const isDark = stored ? stored === "dark" : !!prefersDark;
    setDarkMode(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleTheme = () => {
    const isDark = !darkMode;
    setDarkMode(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  };

  const displayName = user?.username || "Guest";
  const avatarSrc = user
    ? `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.username)}`
    : undefined;

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/85 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between gap-3 px-3 md:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <SidebarTrigger className="-ml-1" />
            <div className="flex items-center gap-2">
              <div className="bg-brand-gradient flex h-7 w-7 items-center justify-center rounded-lg text-white shadow-md">
                <span className="text-sm font-black leading-none">W</span>
              </div>
              <span className="truncate text-lg font-bold tracking-tight">
                <span className="text-primary">Winstone</span>
                <span className="text-brand-gradient">.ai</span>
              </span>
            </div>
            <span className="hidden items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline-flex">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  health?.ai_configured ? "bg-emerald-500" : "bg-amber-500"
                )}
              />
              {health?.ai_configured ? health.model || "AI ready" : "Demo mode"}
            </span>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="transition hover:bg-muted"
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <div className="hidden h-6 w-px bg-border sm:block" />

            {user ? (
              <div className="flex items-center gap-2 md:gap-3">
                <div className="hidden items-center gap-2 md:flex">
                  <Avatar className="h-8 w-8 ring-1 ring-primary/30">
                    <AvatarImage src={avatarSrc} alt={displayName} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {displayName[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-[140px] truncate text-sm font-medium">{displayName}</span>
                </div>
                <Button variant="outline" size="sm" onClick={signOut} className="gap-1.5">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign out</span>
                  <span className="sm:hidden">Out</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setAuthMode("signin")} className="hover:bg-muted">
                  Sign in
                </Button>
                <Button
                  size="sm"
                  onClick={() => setAuthMode("signup")}
                  className="bg-brand-gradient text-white shadow-md transition hover:brightness-110"
                >
                  Sign up
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {authMode && (
        <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onSwitch={setAuthMode} />
      )}
    </>
  );
}