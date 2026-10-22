import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/config/appearance";
import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";

// Services throw plain English (it reads well in logs, tests and AI tool results). Just before an error
// leaves the API, it is matched against the English templates in messages/en.json and re-written in the
// visitor's language. A message with no template is passed through unchanged.

type Catalogue = typeof en.serverErrors;
const CATALOGUES: Record<Locale, Catalogue> = { en: en.serverErrors, ar: ar.serverErrors };

interface CompiledTemplate {
  key: keyof Catalogue["messages"];
  pattern: RegExp;
  names: string[];
}

const escape = (text: string) => text.replace(/[.*+?^$()|[\]\\]/g, "\\$&");

const TEMPLATES: CompiledTemplate[] = (
  Object.keys(en.serverErrors.messages) as Array<keyof Catalogue["messages"]>
).map((key) => {
  const template = en.serverErrors.messages[key];
  const names = [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!);
  const source = escape(template).replace(/\\?\{(\w+)\\?\}/g, "(.+?)");
  return { key, pattern: new RegExp(`^${source}$`), names };
});

/** Translates the variable parts that are words, like "Room" or "held", leaving numbers and lists alone. */
function translateValue(name: string, value: string, catalogue: Catalogue): string {
  if (name === "entity") {
    return catalogue.entities[value.replace(/ /g, "_") as keyof Catalogue["entities"]] ?? value;
  }
  if (name === "from" || name === "to") {
    return catalogue.statuses[value as keyof Catalogue["statuses"]] ?? value;
  }
  return value;
}

export function localizeError(message: string, locale: Locale): string {
  if (locale === "en") return message;
  const catalogue = CATALOGUES[locale];
  for (const template of TEMPLATES) {
    const match = message.match(template.pattern);
    if (!match) continue;
    return template.names.reduce(
      (text, name, index) =>
        text.replace(`{${name}}`, translateValue(name, match[index + 1] ?? "", catalogue)),
      catalogue.messages[template.key],
    );
  }
  return message;
}

/** The visitor's language for an API response: the saved choice, else the browser's. */
export function requestLocale(request: Request): Locale {
  const saved = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === LOCALE_COOKIE)?.[1];
  if (isLocale(saved)) return saved;
  return (request.headers.get("accept-language") ?? "").toLowerCase().startsWith("ar")
    ? "ar"
    : DEFAULT_LOCALE;
}
