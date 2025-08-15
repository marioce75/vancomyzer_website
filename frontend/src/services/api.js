import React from 'react';
import { useTranslation } from 'react-i18next';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Collapse from '@mui/material/Collapse';

function PatientInputForm(props) {
  const { t } = useTranslation();

  return (
    <form>
      <div className="fieldBlock">
        <div className="fieldLabel">{t('fields.ageYears')}</div>
        <TextField
          id="age_years"
          name="age_years"
          type="number"
          aria-label={t('fields.ageYears')}
          variant="outlined"
          InputLabelProps={{ shrink: true }}
          label=""
          value={props.values.age_years}
          onChange={props.handleChange}
          error={!!props.errors.age_years}
          helperText={props.errors.age_years || t('errors.ageAdultMin')}
          inputProps={{ min: 0 }}
        />
      </div>

      <div className="fieldBlock">
        <div className="fieldLabel">{t('fields.gender')}</div>
        <Select
          id="gender"
          name="gender"
          value={props.values.gender}
          onChange={props.handleChange}
          aria-label={t('fields.gender')}
        >
          <MenuItem value="male">{t('genders.male')}</MenuItem>
          <MenuItem value="female">{t('genders.female')}</MenuItem>
        </Select>
      </div>

      <div className="fieldBlock">
        <div className="fieldLabel">{t('fields.weightKg')}</div>
        <TextField
          id="weight_kg"
          name="weight_kg"
          type="number"
          aria-label={t('fields.weightKg')}
          variant="outlined"
          InputLabelProps={{ shrink: true }}
          label=""
          value={props.values.weight_kg}
          onChange={props.handleChange}
          error={!!props.errors.weight_kg}
          helperText={props.errors.weight_kg || t('errors.weightRange')}
          inputProps={{ min: 0 }}
        />
      </div>

      <div className="fieldBlock">
        <div className="fieldLabel">{t('fields.heightCm')}</div>
        <TextField
          id="height_cm"
          name="height_cm"
          type="number"
          aria-label={t('fields.heightCm')}
          variant="outlined"
          InputLabelProps={{ shrink: true }}
          label=""
          value={props.values.height_cm}
          onChange={props.handleChange}
          error={!!props.errors.height_cm}
          helperText={props.errors.height_cm}
          inputProps={{ min: 0 }}
        />
      </div>

      <div className="fieldBlock">
        <div className="fieldLabel">{t('fields.serumCreatinine')}</div>
        <TextField
          id="serum_creatinine"
          name="serum_creatinine"
          type="number"
          aria-label={t('fields.serumCreatinine')}
          variant="outlined"
          InputLabelProps={{ shrink: true }}
          label=""
          value={props.values.serum_creatinine}
          onChange={props.handleChange}
          error={!!props.errors.serum_creatinine}
          helperText={props.errors.serum_creatinine || t('errors.scrRange')}
          inputProps={{ min: 0 }}
        />
      </div>

      <div className="fieldLabel">{t('fields.physicalParameters')}</div>

      <div className="fieldLabel">{t('fields.clinicalInformation')}</div>

      <div className="fieldBlock">
        <div className="fieldLabel">{t('fields.indication')}</div>
        <Select
          id="indication"
          name="indication"
          value={props.values.indication}
          onChange={props.handleChange}
          aria-label={t('fields.indication')}
        >
          <MenuItem value="pneumonia">{t('indications.pneumonia')}</MenuItem>
          <MenuItem value="other">{t('indications.other')}</MenuItem>
        </Select>
      </div>

      <div className="fieldBlock">
        <div className="fieldLabel">{t('fields.infectionSeverity')}</div>
        <Select
          id="severity"
          name="severity"
          value={props.values.severity}
          onChange={props.handleChange}
          aria-label={t('fields.infectionSeverity')}
        >
          <MenuItem value="mild">{t('severities.mild')}</MenuItem>
          <MenuItem value="moderate">{t('severities.moderate')}</MenuItem>
          <MenuItem value="severe">{t('severities.severe')}</MenuItem>
        </Select>
      </div>

      <div className="fieldLabel">{t('fields.advancedOptions')}</div>
      <Collapse in={props.showAdvancedOptions}>
        {/* Advanced options controls here without label props */}
      </Collapse>
    </form>
  );
}

export default PatientInputForm;