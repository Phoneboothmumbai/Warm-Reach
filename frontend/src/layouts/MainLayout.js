import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import {
  LayoutDashboard,
  Users,
  FileText,
  MessageSquare,
  Inbox,
  Settings,
  LogOut,
  Menu,
  X,
  Zap,
  ChevronRight,
  Bell,
  Moon,
  Sun,
  MessageCircle,
  Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { name: "Business Profile", href: "/app/business-profile", icon: Building2 },
  { name: "Contacts", href: "/app/contacts", icon: Users },
  { name: "Blueprints", href: "/app/blueprints", icon: FileText },
  { name: "Messages", href: "/app/messages", icon: MessageSquare },
  { name: "Inbox", href: "/app/inbox", icon: Inbox },
  { name: "WhatsApp", href: "/app/whatsapp", icon: MessageCircle },
  { name: "Settings", href: "/app/settings", icon: Settings },
];

export const MainLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const getInitials = () => {
    if (!user) return "??";
    return `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          data-testid="sidebar-overlay"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        data-testid="sidebar"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">WarmReach</h1>
              <p className="text-xs text-muted-foreground">Outreach Engine</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto lg:hidden"
              onClick={() => setSidebarOpen(false)}
              data-testid="close-sidebar-btn"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 px-3 py-4">
            <nav className="space-y-1">
              {navigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      "sidebar-item",
                      isActive && "active"
                    )
                  }
                  onClick={() => setSidebarOpen(false)}
                  data-testid={`nav-${item.name.toLowerCase()}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                  {item.name === "Inbox" && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      3
                    </Badge>
                  )}
                </NavLink>
              ))}
            </nav>
          </ScrollArea>

          {/* User section */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-muted-foreground truncate capitalize">
                  {user?.role?.replace("_", " ")}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0" data-testid="user-menu-btn">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/settings")} data-testid="settings-menu-item">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} data-testid="logout-menu-item">
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 glass-surface">
          <div className="flex items-center gap-4 px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              data-testid="open-sidebar-btn"
            >
              <Menu className="w-5 h-5" />
            </Button>

            <div className="flex-1" />

            <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="theme-toggle-btn">
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>

            <Button variant="ghost" size="icon" className="relative" data-testid="notifications-btn">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6 lg:p-8 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
};
