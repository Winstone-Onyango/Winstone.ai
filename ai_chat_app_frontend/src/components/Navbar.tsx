import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarTrigger } from "./ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import AuthModal from "./AuthModal";

export default function Navbar() {
  const [darkMode, setDarkMode] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | null>(null);
  const { user, signOut } = useAuth();

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
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger />
            <span className="truncate text-xl font-bold tracking-tight">
              <span className="text-primary">Winstone</span>.ai
            </span>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="hover:bg-muted transition"
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <div className="hidden h-6 w-px bg-border sm:block" />

            {user ? (
              <div className="flex items-center gap-2 md:gap-3">
                <div className="hidden items-center gap-2 md:flex">
                  <Avatar className="h-8 w-8 ring-1 ring-muted-foreground/10">
                    <AvatarImage src={avatarSrc} alt={displayName} />
                    <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="max-w-[140px] truncate text-sm font-medium">
                    {displayName}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={signOut} className="gap-1.5">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign out</span>
                  <span className="sm:hidden">Out</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAuthMode("signin")}
                  className="hover:bg-muted"
                >
                  Sign in
                </Button>
                <Button size="sm" onClick={() => setAuthMode("signup")}>
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
