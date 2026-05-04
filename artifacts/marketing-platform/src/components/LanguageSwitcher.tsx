import { useTranslation, type Locale } from "@/i18n/I18nProvider";
import { Globe } from "lucide-react";

const LOCALES: Array<{ value: Locale; label: string; flag: string }> = [
  { value: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { value: "de", label: "Deutsch", flag: "🇩🇪" },
  { value: "en", label: "English", flag: "🇬🇧" },
];

/**
 * Compact language switcher. Renders as a 3-button segmented control that
 * fits in the sidebar / header. Uses native flag emojis (no asset deps).
 */
export function LanguageSwitcher({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { lang, setLang, t } = useTranslation();

  if (compact) {
    return (
      <div
        className="inline-flex items-center gap-1 p-1 rounded-lg border border-border/50 bg-card"
        data-testid="language-switcher"
      >
        {LOCALES.map((l) => (
          <button
            key={l.value}
            type="button"
            onClick={() => setLang(l.value)}
            aria-pressed={lang === l.value}
            title={l.label}
            className={`text-base px-1.5 py-0.5 rounded transition-colors ${
              lang === l.value
                ? "bg-primary/20 text-primary"
                : "hover:bg-secondary text-muted-foreground"
            }`}
            data-testid={`lang-${l.value}`}
          >
            {l.flag}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">{t("lang.switcher.label")}:</span>
      <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-border/50 bg-card">
        {LOCALES.map((l) => (
          <button
            key={l.value}
            type="button"
            onClick={() => setLang(l.value)}
            aria-pressed={lang === l.value}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              lang === l.value
                ? "bg-primary/20 text-primary font-medium"
                : "hover:bg-secondary text-muted-foreground"
            }`}
            data-testid={`lang-${l.value}`}
          >
            <span className="mr-1">{l.flag}</span>
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
