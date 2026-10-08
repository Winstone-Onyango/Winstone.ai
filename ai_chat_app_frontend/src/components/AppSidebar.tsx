import { MessageSquare, Bot, Zap, MessageSquarePlus, Trash2 } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { Button } from "./ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSevenDaysChats, getTodaysChats, getYesterdaysChats, deleteChat } from "@/lib/api";
import { cn } from "@/lib/utils";

interface IChat { id: string; title: string; created_at?: string; }

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

  const { data: toDaysData } = useQuery({ queryKey: ["todaysChat"], queryFn: getTodaysChats });
  const { data: yesterdaysData } = useQuery({ queryKey: ["yesterdaysChat"], queryFn: getYesterdaysChats });
  const { data: sevenDaysData } = useQuery({ queryKey: ["sevenDaysChat"], queryFn: getSevenDaysChats });

  const recentChats: IChat[] = Array.isArray(toDaysData) ? toDaysData : [];
  const yesterdaysChats: IChat[] = Array.isArray(yesterdaysData) ? yesterdaysData : [];
  const sevenDaysChats: IChat[] = Array.isArray(sevenDaysData) ? sevenDaysData : [];

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
          <div className="group flex items-center gap-1">
            <NavLink to={`/chats/${chat.id}`} className="min-w-0 flex-1">
              {({ isActive }) => (
                <SidebarMenuButton className={cn("flex items-center gap-3 px-4 py-2 rounded-md transition cursor-pointer", isActive ? "bg-muted" : "hover:bg-muted")}>
                  <MessageSquare className="w-4 h-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm truncate">{cleanTitle(chat.title)}</span>
                </SidebarMenuButton>
              )}
            </NavLink>
            <button
              aria-label="Delete chat"
              onClick={() => { if (confirm("Delete this chat?")) del.mutate(chat.id); }}
              className="mr-1 hidden rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  return (
    <Sidebar className="bg-background text-foreground border-r">
      <SidebarContent className="flex flex-col justify-between h-full">
        <div>
          <div className="px-4 pt-4">
            <Button variant="secondary" className="w-full justify-start cursor-pointer gap-2" asChild>
              <Link to="/chats/new">
                <MessageSquarePlus className="w-4 h-4" /> New Chat
              </Link>
            </Button>
          </div>

          {recentChats.length > 0 && (
            <SidebarGroup className="mt-4">
              <SidebarGroupLabel className="text-xs text-muted-foreground uppercase px-4 pb-2">Today</SidebarGroupLabel>
              <SidebarGroupContent>{renderList(recentChats)}</SidebarGroupContent>
            </SidebarGroup>
          )}

          {yesterdaysChats.length > 0 && (
            <SidebarGroup className="mt-4">
              <SidebarGroupLabel className="text-xs text-muted-foreground uppercase px-4 pb-2">Yesterday</SidebarGroupLabel>
              <SidebarGroupContent>{renderList(yesterdaysChats)}</SidebarGroupContent>
            </SidebarGroup>
          )}

          {sevenDaysChats.length > 0 && (
            <SidebarGroup className="mt-4">
              <SidebarGroupLabel className="text-xs text-muted-foreground uppercase px-4 pb-2">Last 7 Days</SidebarGroupLabel>
              <SidebarGroupContent>{renderList(sevenDaysChats)}</SidebarGroupContent>
            </SidebarGroup>
          )}

          {recentChats.length === 0 && yesterdaysChats.length === 0 && sevenDaysChats.length === 0 && (
            <p className="px-4 pt-6 text-sm text-muted-foreground">No conversations yet. Start a new chat.</p>
          )}

          <SidebarGroup className="mt-6">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="#" className="flex items-center gap-3 px-4 py-2 hover:bg-muted rounded-md transition">
                    <Bot className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-semibold">Explore GPTs</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </div>

        <div className="p-4 border-t">
          <Link to="#" className="flex items-center justify-between bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Zap className="w-4 h-4" /> Upgrade to Pro
            </span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">New</Badge>
          </Link>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
