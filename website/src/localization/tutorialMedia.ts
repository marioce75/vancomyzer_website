import type { Locale } from "./catalog";

export type TutorialMedia = {
  locale: Locale;
  src: string;
  poster: string;
  durationSeconds: number;
  captions?: { src: string; language: string; label: string };
};

/** Approved 2026-10-06 release. Keep each locale paired with its own narration and captions. */
export const tutorialMedia: Readonly<Record<Locale, TutorialMedia | null>> = {
  en: {
    locale: "en",
    src: "/videos/vancomyzer-tutorial-en-20261006.mp4",
    poster: "/images/tutorial-en-20261006.jpg",
    durationSeconds: 175.334,
  },
  es: {
    locale: "es",
    src: "/videos/vancomyzer-tutorial-es-20261006.mp4",
    poster: "/images/tutorial-es-20261006.jpg",
    durationSeconds: 208.58,
    captions: { src: "/videos/vancomyzer-tutorial-es-20261006.vtt", language: "es-ES", label: "Español" },
  },
  fr: {
    locale: "fr",
    src: "/videos/vancomyzer-tutorial-fr-20261006.mp4",
    poster: "/images/tutorial-fr-20261006.jpg",
    durationSeconds: 217.233333,
    captions: { src: "/videos/vancomyzer-tutorial-fr-20261006.vtt", language: "fr-FR", label: "Français" },
  },
};

export function getTutorialMedia(locale: Locale): TutorialMedia | null {
  return tutorialMedia[locale];
}

export const tutorialCopy = {
  en: { unavailable: "This tutorial is not available in English yet.", failed: "The tutorial could not be loaded. You can try the direct video link below.", english: "Watch the English tutorial", englishNotice: "English narration and on-screen text", close: "Close tutorial", play: "Play tutorial", direct: "Open video directly" },
  es: { unavailable: "El tutorial en español todavía no está disponible.", failed: "No se ha podido cargar el tutorial. Puede probar el enlace directo al vídeo que aparece a continuación.", english: "Ver el tutorial en inglés", englishNotice: "Narración y texto en pantalla en inglés", close: "Cerrar el tutorial", play: "Reproducir el tutorial", direct: "Abrir el vídeo directamente" },
  fr: { unavailable: "Le tutoriel en français n’est pas encore disponible.", failed: "Le tutoriel n’a pas pu être chargé. Vous pouvez essayer le lien direct vers la vidéo ci-dessous.", english: "Regarder le tutoriel en anglais", englishNotice: "Narration et texte à l’écran en anglais", close: "Fermer le tutoriel", play: "Lire le tutoriel", direct: "Ouvrir la vidéo directement" },
} as const;
