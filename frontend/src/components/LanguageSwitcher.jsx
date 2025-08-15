import React from 'react';
import { Box, ToggleButtonGroup, ToggleButton, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const active = (i18n.language || 'en').split('-')[0];

  const handleChange = (event, newLang) => {
    if (!newLang) return;
    i18n.changeLanguage(newLang);
    try { localStorage.setItem('lang', newLang); } catch {}
  };

  return (
    <Box sx={{ ml: 2 }} role="group" aria-label="Language selector">
      <Tooltip title={t('language.select')}>
        <ToggleButtonGroup size="small" value={active} exclusive onChange={handleChange} aria-label="language switcher">
          <ToggleButton value="en" aria-label="English">EN</ToggleButton>
          <ToggleButton value="es" aria-label="Español">ES</ToggleButton>
          <ToggleButton value="ar" aria-label="العربية">ع</ToggleButton>
        </ToggleButtonGroup>
      </Tooltip>
    </Box>
  );
}
