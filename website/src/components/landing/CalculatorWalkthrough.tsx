"use client";
import { LocalizedText } from "@/localization/LanguageProvider";

import { LocalizedVideo, LocalizedButton } from "@/localization/LocalizedElements";


import { useRef, useState } from "react";
import { track } from "@/lib/analytics";

/** The approved calculator tutorial, using fictional inputs. */
export default function CalculatorWalkthrough() {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const trackedPlay = useRef(false);

  function recordPlayback() {
    setStarted(true);
    // Count real playback once per mounted tutorial, not clicks or resumes.
    if (trackedPlay.current) return;
    trackedPlay.current = true;
    track("Tutorial Play", { tutorial: "calculator_walkthrough_v2" });
  }

  async function play() {
    setStarted(true);
    try {
      await video.current?.play();
    } catch {
      // Native controls and the direct link remain available if playback fails.
    }
    video.current?.focus();
  }

  return (
    <figure>
      <div className="relative aspect-video overflow-hidden rounded-md border bg-white shadow-sm" style={{ borderColor: "#cbd6e0" }}>
        <LocalizedVideo
          ref={video}
          className="block h-full w-full object-contain"
          controls={started}
          playsInline
          preload="none"
          poster="/images/calculator-result-fictional.png"
          aria-label="Vancomyzer calculator tutorial with Bayesian estimation and loading dose guidance"
          aria-describedby="walkthrough-caption"
          onPlay={() => setStarted(true)}
          onPlaying={recordPlayback}
        >
          <source src="/videos/vancomyzer-calculator-tutorial-v2.mp4" type="video/mp4" /><LocalizedText text={"Your browser does not support embedded video. Use the video link below."} /></LocalizedVideo>
        {!started && (
          <LocalizedButton
            type="button"
            onClick={play}
            className="absolute inset-0 flex w-full flex-col items-center justify-center gap-3 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-[#1f5e96]"
            style={{ background: "linear-gradient(0deg,rgba(20,35,47,.55),rgba(20,35,47,.02) 75%)", color: "#fff" }}
            aria-label="Play the 2 minute 55 second Vancomyzer walkthrough"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white shadow-lg sm:h-[72px] sm:w-[72px]" style={{ background: "#1f5e96" }} aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 4v16l13-8z" /></svg>
            </span>
            <span className="text-sm font-semibold sm:text-base"><LocalizedText text={"Watch the walkthrough"} /></span>
            <span className="absolute bottom-3 right-3 rounded px-2 py-0.5 text-sm" style={{ background: "#14232f" }}>2:55</span>
          </LocalizedButton>
        )}
      </div>
      <figcaption id="walkthrough-caption" className="mt-3 text-[13px] leading-[1.5]" style={{ color: "#546471" }}><LocalizedText text={"Calculator walkthrough using fictional inputs, including Bayesian estimation and loading dose guidance. For learning the interface. Independent clinical validation is pending."} />{started && <> <a className="underline" href="/videos/vancomyzer-calculator-tutorial-v2.mp4"><LocalizedText text={"Open video directly"} /></a>.</>}
      </figcaption>
    </figure>
  );
}
