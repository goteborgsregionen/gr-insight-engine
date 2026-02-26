import { Menu, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import logoHorizontalBlack from "@/assets/logo-horizontal-black.png";

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header = ({ onMenuClick }: HeaderProps) => {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <header className="h-16 border-b border-border bg-background flex items-center px-4 sticky top-0 z-50">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="lg:hidden mr-2"
        aria-label="Öppna meny"
      >
        <Menu className="h-5 w-5" />
      </Button>
      
      <div className="flex items-center flex-1">
        <img 
          src={logoHorizontalBlack} 
          alt="Göteborgsregionen" 
          className="h-8 dark:invert"
        />
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsDark(!isDark)}
        aria-label={isDark ? "Byt till ljust läge" : "Byt till mörkt läge"}
      >
        {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>
    </header>
  );
};
