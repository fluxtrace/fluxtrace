import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import enBase from "./locales/en.json";
import pagesEn from "./locales/pages.en.json";
import ptBRBase from "./locales/pt-BR.json";
import pagesPtBR from "./locales/pages.pt-BR.json";

const en = { ...enBase, ...pagesEn };
const ptBR = { ...ptBRBase, ...pagesPtBR };

/** Chave `localStorage` para a língua escolhida (evita colisão com outras apps). */
export const I18N_STORAGE_KEY = "fluxtrace_i18n_lang";

function applyHtmlLang(lng: string) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lng === "en" ? "en" : "pt-BR";
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      "pt-BR": { translation: ptBR },
    },
    fallbackLng: "pt-BR",
    supportedLngs: ["pt-BR", "en"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage"],
      caches: ["localStorage"],
      lookupLocalStorage: I18N_STORAGE_KEY,
    },
  });

applyHtmlLang(i18n.resolvedLanguage ?? i18n.language);
i18n.on("languageChanged", applyHtmlLang);

export default i18n;
