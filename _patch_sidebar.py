import io, sys, traceback

fe = r"C:\Users\Winstone\Desktop\Winstone\ChatApp\ai_chat_app_frontend\src"
p = fe + r"\components\AppSidebar.tsx"

try:
    s = open(p, encoding="utf-8").read()
    results = []

    def rep(old, new, tag):
        global s
        if old in s:
            s = s.replace(old, new, 1)
            results.append("OK:" + tag)
        else:
            results.append("MISS:" + tag)

    if "@/context/AuthContext" not in s:
        rep('import { cn } from "@/lib/utils";',
            'import { cn } from "@/lib/utils";\nimport { useAuth } from "@/context/AuthContext";',
            "auth-import")
    else:
        results.append("SKIP:auth-import")

    if "const { user } = useAuth" not in s:
        rep("  const queryClient = useQueryClient();",
            "  const queryClient = useQueryClient();\n  const { user } = useAuth();",
            "user-hook")
    else:
        results.append("SKIP:user-hook")

    rep('queryKey: ["todaysChat"], queryFn: getTodaysChats',
        'queryKey: ["todaysChat"], queryFn: getTodaysChats, enabled: !!user', "q1")
    rep('queryKey: ["yesterdaysChat"], queryFn: getYesterdaysChats',
        'queryKey: ["yesterdaysChat"], queryFn: getYesterdaysChats, enabled: !!user', "q2")
    rep('queryKey: ["sevenDaysChat"], queryFn: getSevenDaysChats',
        'queryKey: ["sevenDaysChat"], queryFn: getSevenDaysChats, enabled: !!user', "q3")

    open(p, "w", encoding="utf-8").write(s)
    print("SIDEBAR:", " | ".join(results))
except Exception:
    traceback.print_exc()
    sys.exit(1)
