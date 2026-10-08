import { useState } from "react";
import { MessageSquare, MessageSquarePlus, Search, Trash2, X } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { Button } from "./ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteChat, getHealth, getSevenDaysChats, getTodaysChats, getYesterdaysChats } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

interface IChat {
  id: string;
  title: string;
  created_at?: string;
}

function cleanTitle(t?: string) {
  if (!t) return "New conversation";
  const s = t.trim();
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1) || "New conversation";
  }
  return s;
}

export function AppSidebar() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { chat_uid } = useParams();
  const [search, setSearch] = useState("");

  const { user } = useAuth();
  const { data: toDaysData } = useQuery({ queryKey: ["todaysChat"], queryFn: getTodaysChats, enabled: !!user });
  const { data: yesterdaysData } = useQuery({ queryKey: ["yesterdaysChat"], queryFn: getYesterdaysChats, enabled: !!user });
  const { data: sevenDaysData } = useQuery({ queryKey: ["sevenDaysChat"], queryFn: getSevenDaysChats, enabled: !!user });
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const q = search.trim().toLowerCase();
  const match = (c: IChat) => !q || (c.title || "").toLowerCase().includes(q);
  const recentChats: IChat[] = (Array.isArray(toDaysData) ? toDaysData : []).filter(match);
  const yesterdaysChats: IChat[] = (Array.isArray(yesterdaysData) ? yesterdaysData : []).filter(match);
  const sevenDaysChats: IChat[] = (Array.isArray(sevenDaysData) ? sevenDaysData : []).filter(match);
  const totalChats = recentChats.length + yesterdaysChats.length + sevenDaysChats.length;

  const del = useMutation({
    mutationFn: deleteChat,
    onSuccess: (_d, id) => {
      queryClient.invalidateQueries({ queryKey: ["todaysChat"] });
      queryClient.invalidateQueries({ queryKey: ["yesterdaysChat"] });
      queryClient.invalidateQueries({ queryKey: ["sevenDaysChat"] });
      if (chat_uid === id) navigate("/chats/new");
    },
  });

  const renderList = (chats: IChat[]) => (
    <SidebarMenu>
      {chats.map((chat) => (
        <SidebarMenuItem key={chat.id}>
          <div className="group/item flex items-center gap-1">
            <NavLink to={`/chats/${chat.id}`} className="min-w-0 flex-1" title={cleanTitle(chat.title)}>
              {({ isActive }) => (
                <SidebarMenuButton
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition",
                    isActive ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"
                  )}
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm">{cleanTitle(chat.title)}</span>
                </SidebarMenuButton>
              )}
            </NavLink>
            <button
              aria-label="Delete chat"
              onClick={() => {
                if (confirm("Delete this chat?")) del.mutate(chat.id);
              }}
              className="mr-1 hidden rounded p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive group-hover/item:block"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  const group = (label: string, chats: IChat[]) =>
    chats.length > 0 && (
      <SidebarGroup className="mt-3 px-0">
        <SidebarGroupLabel className="px-4 pb-1 text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </SidebarGroupLabel>
        <SidebarGroupContent>{renderList(chats)}</SidebarGroupContent>
      </SidebarGroup>
    );

  return (
    <Sidebar className="border-r bg-sidebar text-sidebar-foreground">
      <SidebarContent className="flex flex-col">
        {/* New chat + search */}
        <div className="space-y-2.5 px-3 pt-3">
          <Button
            asChild
            className="bg-brand-gradient w-full justify-start gap-2 text-white shadow-md transition hover:brightness-110"
          >
            <Link to="/chats/new">
              <MessageSquarePlus className="h-4 w-4" /> New Chat
            </Link>
          </Button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats…"
              aria-label="Search chats"
              className="h-9 bg-muted/50 pl-8 pr-8 text-sm"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* History */}
        <div className="mt-1 min-h-0 flex-1 overflow-y-auto">
          {group("Today", recentChats)}
          {group("Yesterday", yesterdaysChats)}
          {group("Last 7 Days", sevenDaysChats)}

          {totalChats === 0 && (
            <div className="mt-10 flex flex-col items-center px-6 text-center text-muted-foreground">
              <MessageSquare className="mb-3 h-8 w-8 opacity-40" />
              <p className="text-sm">{q ? "No chats match your search." : "No conversations yet."}</p>
              {!q && <p className="mt-1 text-xs">Start a new chat and it will show up here.</p>}
            </div>
          )}
        </div>

        {/* AI status */}
        <div className="border-t p-3">
          <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2">
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                health?.ai_configured ? "animate-pulse bg-emerald-500" : "bg-amber-500"
              )}
            />
            <span className="truncate text-xs font-medium">
              {health?.ai_configured ? health.model || "AI ready" : "Demo mode"}
            </span>
            <span className="bg-brand-gradient ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-black leading-none text-white">W</span>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}