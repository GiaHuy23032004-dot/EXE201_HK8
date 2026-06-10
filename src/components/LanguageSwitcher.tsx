import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";

interface LanguageSwitcherProps {
  /** compact = chỉ hiện icon globe, full = hiện icon + tên ngôn ngữ */
  variant?: "compact" | "full";
}

export function LanguageSwitcher({ variant = "compact" }: LanguageSwitcherProps) {
  const { lang, setLang, t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={variant === "compact" ? "icon" : "sm"}
          className="text-muted-foreground hover:text-foreground"
          title={t("lang.switch")}
        >
          <Globe className="h-4 w-4" />
          {variant === "full" && (
            <span className="ml-1.5 text-xs font-medium">
              {lang === "vi" ? "VI" : "EN"}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onClick={() => setLang("vi")}
          className={lang === "vi" ? "bg-accent text-accent-foreground font-medium" : ""}
        >
          <span className="mr-2 text-base">🇻🇳</span>
          {t("lang.vi")}
          {lang === "vi" && <span className="ml-auto text-xs text-primary">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLang("en")}
          className={lang === "en" ? "bg-accent text-accent-foreground font-medium" : ""}
        >
          <span className="mr-2 text-base">🇬🇧</span>
          {t("lang.en")}
          {lang === "en" && <span className="ml-auto text-xs text-primary">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
