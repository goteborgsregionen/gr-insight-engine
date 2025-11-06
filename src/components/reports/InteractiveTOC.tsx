import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface TOCSection {
  id: string;
  title: string;
  level: number;
}

interface InteractiveTOCProps {
  content: string;
  className?: string;
}

export function InteractiveTOC({ content, className }: InteractiveTOCProps) {
  const [sections, setSections] = useState<TOCSection[]>([]);
  const [activeSection, setActiveSection] = useState<string>("");

  useEffect(() => {
    // Extract headings from markdown content
    const headingRegex = /^(#{1,3})\s+(.+)$/gm;
    const matches = Array.from(content.matchAll(headingRegex));
    
    const extractedSections = matches.map((match, index) => ({
      id: `section-${index}`,
      title: match[2].trim(),
      level: match[1].length,
    }));

    setSections(extractedSections);
  }, [content]);

  useEffect(() => {
    const handleScroll = () => {
      const headings = document.querySelectorAll('h1, h2, h3');
      let current = "";

      headings.forEach((heading) => {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= 150) {
          current = heading.id || "";
        }
      });

      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth'
      });
    }
  };

  if (sections.length === 0) return null;

  return (
    <Card className={cn("sticky top-20", className)}>
      <CardHeader>
        <CardTitle className="text-lg">Innehåll</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-200px)]">
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={cn(
                  "w-full text-left text-sm py-2 px-3 rounded-md transition-colors flex items-start gap-2 hover:bg-accent",
                  activeSection === section.id && "bg-accent text-accent-foreground font-medium",
                  section.level === 2 && "pl-6",
                  section.level === 3 && "pl-9"
                )}
              >
                {activeSection === section.id && (
                  <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                )}
                <span className={cn(!activeSection || activeSection !== section.id ? "pl-6" : "")}>
                  {section.title}
                </span>
              </button>
            ))}
          </nav>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}