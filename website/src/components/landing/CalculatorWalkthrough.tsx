"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LocalizedText, useLanguage } from "@/localization/LanguageProvider";
import { LocalizedVideo } from "@/localization/LocalizedElements";
import { getTutorialMedia, tutorialCopy, tutorialDuration, type TutorialMedia } from "@/localization/tutorialMedia";
import type { Locale } from "@/localization/catalog";
import { track } from "@/lib/analytics";

/** Each language owns a fresh player; a switch never resumes another language's audio. */
export default function CalculatorWalkthrough() {
  const { locale } = useLanguage();
  return <LocaleWalkthrough key={locale} locale={locale} />;
}

function LocaleWalkthrough({ locale }: { locale: Locale }) {
  const [showEnglish, setShowEnglish] = useState(false);
  const copy = tutorialCopy[locale];
  const media = getTutorialMedia(showEnglish ? "en" : locale);
  const captionId = useId();
  return <figure>
    {!media ? <div className="rounded-md border bg-slate-50 p-6 text-slate-800" role="status">
      <p>{copy.unavailable}</p>
      {locale !== "en" && <button type="button" className="mt-4 rounded border border-current px-4 py-2 font-semibold" onClick={() => setShowEnglish(true)}>{copy.english}</button>}
    </div> : <>
      {showEnglish && <p className="mb-2 text-sm font-semibold">{copy.englishNotice}</p>}
      <TutorialPlayer key={media.src} media={media} locale={locale} captionId={captionId} />
    </>}
    <figcaption id={captionId} className="mt-3 text-[13px] leading-[1.5]" style={{ color: "#546471" }}>
      <LocalizedText text="Calculator walkthrough using fictional inputs, including Bayesian estimation and loading dose guidance. For learning the interface. Independent clinical validation is pending." />
    </figcaption>
  </figure>;
}

function TutorialPlayer({ media, locale, captionId }: { media: TutorialMedia; locale: Locale; captionId: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const trackedPlay = useRef(false);
  const copy = tutorialCopy[locale];
  useEffect(() => {
    const element = video.current;
    return () => { element?.pause(); };
  }, []);

  function recordPlayback() {
    setStarted(true);
    if (trackedPlay.current) return;
    trackedPlay.current = true;
    track("Tutorial Play", { tutorial: "calculator_walkthrough_v2", language: media.locale });
  }

  async function play() {
    const element = video.current;
    setStarted(true);
    try { await element?.play(); } catch { /* Native controls remain available. */ }
    if (element?.isConnected) element.focus();
  }

  function close() {
    video.current?.pause();
    if (video.current && video.current.readyState > 0) video.current.currentTime = 0;
    setStarted(false);
  }

  const duration = tutorialDuration(media);
  return <>
    <div className="relative overflow-hidden rounded-md border bg-white shadow-sm" style={{ borderColor: "#cbd6e0", aspectRatio: media.locale === "en" ? "16 / 9" : "3 / 2" }}>
      <LocalizedVideo ref={video} src={media.src} lang={media.locale} className="block h-full w-full object-contain" controls={started} playsInline preload="none" poster={media.poster}
        aria-label="Vancomyzer calculator tutorial with Bayesian estimation and loading dose guidance" aria-describedby={captionId}
        onPlay={() => setStarted(true)} onPlaying={recordPlayback} onError={() => { video.current?.pause(); setFailed(true); }}>
        {media.captions && <track kind="captions" src={media.captions.src} srcLang={media.captions.language} label={media.captions.label} />}
        <LocalizedText text="Your browser does not support embedded video. Use the video link below." />
      </LocalizedVideo>
      {!started && !failed && <button type="button" onClick={play} aria-label={copy.play}
        className="absolute inset-0 flex w-full flex-col items-center justify-center gap-3 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-[#1f5e96]"
        style={{ background: "linear-gradient(0deg,rgba(20,35,47,.55),rgba(20,35,47,.02) 75%)", color: "#fff" }}>
        <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white shadow-lg sm:h-[72px] sm:w-[72px]" style={{ background: "#1f5e96" }} aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 4v16l13-8z" /></svg>
        </span>
        <span className="text-sm font-semibold sm:text-base"><LocalizedText text="Watch the walkthrough" /></span>
        <span className="absolute bottom-3 right-3 rounded px-2 py-0.5 text-sm" style={{ background: "#14232f" }}>{duration}</span>
      </button>}
    </div>
    {failed && <p className="mt-3 text-sm" role="alert">{copy.failed}</p>}
    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
      {started && <button type="button" className="rounded border border-current px-3 py-2" onClick={close}>{copy.close}</button>}
      <a className="underline" href={media.src} hrefLang={media.locale}>{copy.direct}</a>
    </div>
  </>;
}

/** Keep homepage links and the player on the same locale-specific duration. */
export function TutorialLinkLabel() {
  const { locale } = useLanguage();
  const media = getTutorialMedia(locale);
  return <>{tutorialCopy[locale].watch}{media && ` · ${tutorialDuration(media)}`}</>;
}
