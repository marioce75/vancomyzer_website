import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en/common.json';
import es from './locales/es/common.json';
import ar from './locales/ar/common.json';

const resources = { en: { common: en }, es: { common: es }, ar: { common: ar } };

const stored = typeof window !== 'undefined' ? localStorage.getItem('lang') : null;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: stored || 'en',
    fallbackLng: 'en',
    ns: ['common'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: [] }
  });

export default i18n;
