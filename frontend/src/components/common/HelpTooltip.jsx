import React from 'react';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Tooltip, IconButton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function HelpTooltip({ title, titleKey, linkTo, onClick, sx }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const text = title ?? (titleKey ? t(titleKey) : '');

  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) return onClick(e);
    if (linkTo) navigate(linkTo);
  };

  return (
    <Tooltip title={text} enterTouchDelay={0} arrow>
      <IconButton
        size="small"
        aria-label="help"
        onClick={handleClick}
        sx={{ ml: 0.5, p: 0.25, ...sx }}
      >
        <HelpOutlineIcon fontSize="inherit" />
      </IconButton>
    </Tooltip>
  );
}
