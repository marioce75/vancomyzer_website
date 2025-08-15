import React from 'react';
import { Box, ToggleButtonGroup, ToggleButton, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [lang, setLang] = React.useState(i18n.language);

  const handleChange = (event, newLang) => {
    if (!newLang) return;
    setLang(newLang);
    i18n.changeLanguage(newLang);
    try { localStorage.setItem('lang', newLang); } catch {}
    if (newLang === 'ar') {
      document.dir = 'rtl';
    } else {
      document.dir = 'ltr';
    }
  };

  return (
    <Box sx={{ ml: 2 }}>
      <Tooltip title={t('language.select')}>
        <ToggleButtonGroup size="small" value={lang} exclusive onChange={handleChange} aria-label="language switcher">
          <ToggleButton value="en" aria-label="English">EN</ToggleButton>
            <ToggleButton value="es" aria-label="Español">ES</ToggleButton>
            <ToggleButton value="ar" aria-label="العربية">ع</ToggleButton>
        </ToggleButtonGroup>
      </Tooltip>
    </Box>
  );
}
