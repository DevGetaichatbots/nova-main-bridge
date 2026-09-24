import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import axios from 'axios';
import da from './locales/da.json';
import en from './locales/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      da: { translation: da },
      en: { translation: en }
    },
    fallbackLng: 'da',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage']
    },
    interpolation: { escapeValue: false }
  });

// Tell the backend which language to answer in (it reads Accept-Language).
const setApiLanguage = (lng) => {
  axios.defaults.headers.common['Accept-Language'] = lng;
};
setApiLanguage(i18n.language || 'da');
i18n.on('languageChanged', setApiLanguage);

const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  if (!headers.has('Accept-Language')) headers.set('Accept-Language', i18n.language || 'da');
  return nativeFetch(input, { ...init, headers });
};

export default i18n;
