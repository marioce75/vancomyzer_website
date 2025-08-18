import React from 'react';
import { Stack, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function LanguageSelector(){
  const { i18n } = useTranslation();
  const current = i18n.language?.split('-')[0] || 'en';
  const setLang = (lng) => () => i18n.changeLanguage(lng);
  return (
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', mb: 2 }}>
      <Button variant={current==='en'?'contained':'outlined'} size="small" onClick={setLang('en')}>EN</Button>
      <Button variant={current==='es'?'contained':'outlined'} size="small" onClick={setLang('es')}>ES</Button>
      <Button variant={current==='ar'?'contained':'outlined'} size="small" onClick={setLang('ar')}>العربية</Button>
    </Stack>
  );
}
