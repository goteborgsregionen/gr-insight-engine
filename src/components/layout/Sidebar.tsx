import { NavLink } from "react-router-dom";
import { Home, FileText, BarChart3, MessageSquare, Settings, Upload, TrendingUp, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { to: "/dashboard", icon: Home, label: "Dashboard" },
  { to: "/documents", icon: FileText, label: "Dokument" },
  { to: "/documents/upload", icon: Upload, label: "Ladda upp" },
  { to: "/analysis", icon: TrendingUp, label: "Analys" },
  { to: "/reports", icon: BarChart3, label: "Rapporter" },
  { to: "/chat", icon: MessageSquare, label: "AI-chatt" },
  { to: "/presentation", icon: Presentation, label: "Presentation" },
  { to: "/settings", icon: Settings, label: "Inställningar" },
];

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 h-screen w-64 bg-sidebar border-r border-sidebar-border z-50 transition-transform duration-300 flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-6 border-b border-sidebar-border">
          <h2 className="text-lg font-semibold text-sidebar-foreground">
            Dokumentanalys
          </h2>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => onClose()}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-md transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};
