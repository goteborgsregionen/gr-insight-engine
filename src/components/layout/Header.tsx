import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoHorizontalBlack from "@/assets/logo-horizontal-black.png";

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header = ({ onMenuClick }: HeaderProps) => {
  return (
    <header className="h-16 border-b border-border bg-background flex items-center px-4 sticky top-0 z-50">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="lg:hidden mr-2"
      >
        <Menu className="h-5 w-5" />
      </Button>
      
      <div className="flex items-center">
        <img 
          src={logoHorizontalBlack} 
          alt="Göteborgsregionen" 
          className="h-8 dark:invert"
        />
      </div>
    </header>
  );
};
