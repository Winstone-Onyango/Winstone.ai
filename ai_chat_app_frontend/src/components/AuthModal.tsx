import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { LogIn, UserPlus, Loader2, X } from "lucide-react";

interface Props {
  mode: "signin" | "signup";
  onClose: () => void;
  onSwitch: (mode: "signin" | "signup") => void;
}

export default function AuthModal({ mode, onClose, onSwitch }: Props) {
  const { signIn, signUp } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isSignup) {
        if (!username.trim() || !email.trim() || !password) {
          throw new Error("Please fill in username, email and password.");
        }
        await signUp(username.trim(), email.trim(), password);
      } else {
        const identifier = username.trim() || email.trim();
        if (!identifier || !password) {
          throw new Error("Please enter your username/email and password.");
        }
        await signIn(identifier, password);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {isSignup ? "Create your account" : "Welcome back"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSignup
                ? "Join Winstone.ai and start chatting in seconds."
                : "Sign in to continue your conversations."}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {isSignup && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <Input
                placeholder="e.g. winstone"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
          )}
          {!isSignup && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Username or email</label>
              <Input
                placeholder="Enter username or email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
          )}
          {isSignup && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <Input
              type="password"
              placeholder={isSignup ? "Min. 6 characters" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignup ? "new-password" : "current-password"}
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isSignup ? "Creating account..." : "Signing in..."}
              </>
            ) : isSignup ? (
              <>
                <UserPlus className="h-4 w-4" />
                Create account
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Sign in
              </>
            )}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <button
                className="font-semibold text-primary hover:underline"
                onClick={() => onSwitch("signin")}
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              New to Winstone.ai?{" "}
              <button
                className="font-semibold text-primary hover:underline"
                onClick={() => onSwitch("signup")}
              >
                Create account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
