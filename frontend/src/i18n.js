import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      title: 'Vancomyzer Web',
      slogan: 'Interactive Evidence-Based Vancomycin Dosing Calculator',
      bullets: {
        guidelines: 'Following ASHP/IDSA 2020 Guidelines',
        realtimeAuc: 'Real-time AUC Visualization',
        bayesian: 'Bayesian Optimization'
      },
      tabs: {
        adult: 'Adult',
        pediatric: 'Pediatric',
        neonate: 'Neonate',
        interactiveAuc: 'Interactive AUC',
        clinicalInfo: 'Clinical Info'
      },
      badges: {
        evidenceBased: 'Evidence-based',
        bayesianOptimization: 'Bayesian optimization'
      },
      buttons: { guidelines: 'Guidelines' },
      app: { title: 'Vancomyzer Web', subtitle: '', tagline: '' },
      nav: { interactive_auc: 'Interactive AUC', clinical_info: 'Clinical Info' },
      patient: 'Patient',
      age: 'Age',
      gender: 'Gender',
      male: 'Male',
      female: 'Female',
      weight: 'Weight',
      height: 'Height',
      scr: 'SCr',
      mic: 'MIC',
      auc24: 'AUC24',
      predicted_trough: 'Predicted trough',
      predicted_peak: 'Predicted peak',
      dose: 'Dose',
      interval: 'Interval',
      infusion: 'Infusion',
      shade_auc: 'Shade 0–24h AUC',
      show_dose_markers: 'Show dose markers',
      bayesian: 'Bayesian',
      updating: 'Updating…',
      copy_json: 'Copy JSON',
      export_pdf: 'Export PDF',
      measured_levels: 'Measured Levels',
      mode: 'Mode',
      no_levels: 'No levels',
      one_level_bayesian: 'One level (Bayesian)',
      two_levels_peak_trough: 'Two levels (peak + trough)',
      peak_random: 'Peak/random',
      hours_after_infusion_end: 'Hours after infusion end',
      trough: 'Trough',
      trough_time: 'Trough time',
      hours: 'Hours',
      concentration: 'Concentration'
    }
  },
  es: {
    translation: {
      title: 'Vancomyzer Web',
      slogan: 'Calculadora interactiva de dosificación de vancomicina basada en evidencia',
      bullets: {
        guidelines: 'Siguiendo las guías ASHP/IDSA 2020',
        realtimeAuc: 'Visualización de AUC en tiempo real',
        bayesian: 'Optimización bayesiana'
      },
      tabs: {
        adult: 'Adulto',
        pediatric: 'Pediátrico',
        neonate: 'Neonato',
        interactiveAuc: 'AUC Interactiva',
        clinicalInfo: 'Información clínica'
      },
      badges: {
        evidenceBased: 'Basado en evidencia',
        bayesianOptimization: 'Optimización bayesiana'
      },
      buttons: { guidelines: 'Guías' },
      app: { title: 'Vancomyzer Web', subtitle: '', tagline: '' },
      nav: { interactive_auc: 'AUC interactivo', clinical_info: 'Información clínica' },
      patient: 'Paciente',
      age: 'Edad',
      gender: 'Sexo',
      male: 'Hombre',
      female: 'Mujer',
      weight: 'Peso',
      height: 'Altura',
      scr: 'SCr',
      mic: 'MIC',
      auc24: 'AUC24',
      predicted_trough: 'Valle previsto',
      predicted_peak: 'Pico previsto',
      dose: 'Dosis',
      interval: 'Intervalo',
      infusion: 'Infusión',
      shade_auc: 'Sombrear AUC 0–24h',
      show_dose_markers: 'Mostrar marcadores de dosis',
      bayesian: 'Bayesiano',
      updating: 'Actualizando…',
      copy_json: 'Copiar JSON',
      export_pdf: 'Exportar PDF',
      measured_levels: 'Niveles medidos',
      mode: 'Modo',
      no_levels: 'Sin niveles',
      one_level_bayesian: 'Un nivel (Bayesiano)',
      two_levels_peak_trough: 'Dos niveles (pico + valle)',
      peak_random: 'Pico/aleatorio',
      hours_after_infusion_end: 'Horas después del fin de la infusión',
      trough: 'Valle',
      trough_time: 'Tiempo de valle',
      hours: 'Horas',
      concentration: 'Concentración'
    }
  },
  ar: {
    translation: {
      title: 'فانكومايزر ويب',
      slogan: 'حاسبة تفاعلية لجرعات الفانكومايسين قائمة على الأدلة',
      bullets: {
        guidelines: 'وفق إرشادات ASHP/IDSA لعام 2020',
        realtimeAuc: 'تصوير فوري لمساحة تحت المنحنى',
        bayesian: 'تحسين بايزي'
      },
      tabs: {
        adult: 'بالغ',
        pediatric: 'أطفال',
        neonate: 'حديثو الولادة',
        interactiveAuc: 'AUC تفاعلي',
        clinicalInfo: 'معلومات سريرية'
      },
      badges: {
        evidenceBased: 'قائم على الأدلة',
        bayesianOptimization: 'تحسين بايزي'
      },
      buttons: { guidelines: 'الإرشادات' },
      app: { title: 'فانكومايزر ويب', subtitle: '', tagline: '' },
      nav: { interactive_auc: 'AUC تفاعلي', clinical_info: 'معلومات سريرية' },
      patient: 'المريض',
      age: 'العمر',
      gender: 'الجنس',
      male: 'ذكر',
      female: 'أنثى',
      weight: 'الوزن',
      height: 'الطول',
      scr: 'الكرياتينين المصلي',
      mic: 'MIC',
      auc24: 'AUC24',
      predicted_trough: 'القاع المتوقع',
      predicted_peak: 'الذروة المتوقعة',
      dose: 'الجرعة',
      interval: 'الفاصل',
      infusion: 'التسريب',
      shade_auc: 'تظليل AUC 0–24 ساعة',
      show_dose_markers: 'إظهار علامات الجرعات',
      bayesian: 'بايزي',
      updating: 'جارٍ التحديث…',
      copy_json: 'نسخ JSON',
      export_pdf: 'تصدير PDF',
      measured_levels: 'المستويات المقاسة',
      mode: 'الوضع',
      no_levels: 'لا توجد مستويات',
      one_level_bayesian: 'مستوى واحد (بايزي)',
      two_levels_peak_trough: 'مستويان (ذروة + قاع)',
      peak_random: 'ذروة/عشوائي',
      hours_after_infusion_end: 'الساعات بعد نهاية التسريب',
      trough: 'القاع',
      trough_time: 'وقت القاع',
      hours: 'الساعات',
      concentration: 'التركيز'
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

export default i18n;
