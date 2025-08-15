import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Load JSON bundles
import en from './en/translation.json';
import es from './es/translation.json';
import ar from './ar/translation.json';

const resources = {
  en: { translation: en },
  es: { translation: es },
  ar: { translation: ar }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'es', 'ar'],
    defaultNS: 'translation',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag', 'cookie'],
      caches: []
    }
  });

// Flip document language and direction on language change (RTL for Arabic)
i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') {
    const base = (lng || 'en').split('-')[0];
    document.documentElement.setAttribute('lang', base);
    document.documentElement.setAttribute('dir', base === 'ar' ? 'rtl' : 'ltr');
  }
});

// Set initial lang/dir attributes based on current language
if (typeof document !== 'undefined') {
  const base = (i18n.language || 'en').split('-')[0];
  document.documentElement.setAttribute('lang', base);
  document.documentElement.setAttribute('dir', base === 'ar' ? 'rtl' : 'ltr');
}

export default i18n;
