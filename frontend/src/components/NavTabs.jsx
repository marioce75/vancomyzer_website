import React from 'react';
import { Tabs, Tab } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NavTabs(){
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const routes = ['/', '/pediatric', '/neonate'];
  const value = routes.includes(pathname) ? pathname : '/';

  if (process.env.NODE_ENV !== 'production') {
    // diagnostics
    // eslint-disable-next-line no-console
    console.debug('[Router] pathname=', pathname);
  }

  return (
    <Tabs value={value} variant="scrollable" allowScrollButtonsMobile>
      <Tab value="/"          label={t('nav.adult','Adult')}         component={RouterLink} to="/" />
      <Tab value="/pediatric" label={t('nav.pediatric','Pediatrics')} component={RouterLink} to="/pediatric" />
      <Tab value="/neonate"   label={t('nav.neonate','Neonate')}     component={RouterLink} to="/neonate" />
    </Tabs>
  );
}
