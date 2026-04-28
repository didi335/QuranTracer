import { useState, useRef, useEffect, useCallback } from "react";
import { fetchChapterAudio } from "@/services/quranApi";

export type AudioState = "idle" | "loading" | "playing" | "paused" | "error";

export interface AudioStatus {
  state:       AudioState;
  chapterId:   number | null;
  reciterId:   number;
  currentTime: number;
  duration:    number;
  reciterName: string;
  error:       string | null;
}

export interface AudioControls {
  status:        AudioStatus;
  playChapter:   (chapterId: number) => void;
  pause:         () => void;
  resume:        () => void;
  stop:          () => void;
  seek:          (seconds: number) => void;
  setReciter:    (reciterId: number) => void;
}

export function useAudio(): AudioControls {
  const [state,       setState]       = useState<AudioState>("idle");
  const [chapterId,   setChapterId]   = useState<number | null>(null);
  const [reciterId,   setReciterIdSt] = useState<number>(7); // Mishari al-Afasy default
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [reciterName, setReciterName] = useState("Mishari Rashid al-Afasy");
  const [error,       setError]       = useState<string | null>(null);

  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const reciterRef  = useRef(reciterId);

  /* Keep reciterRef in sync */
  useEffect(() => { reciterRef.current = reciterId; }, [reciterId]);

  /* Wire up Audio element events once */
  const getAudio = useCallback((): HTMLAudioElement => {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio();
    audio.preload = "auto";

    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
    audio.addEventListener("timeupdate",     () => setCurrentTime(audio.currentTime));
    audio.addEventListener("playing",        () => setState("playing"));
    audio.addEventListener("pause",          () => setState(s => s === "idle" ? s : "paused"));
    audio.addEventListener("ended",          () => { setState("idle"); setCurrentTime(0); });
    audio.addEventListener("error",          () => {
      setState("error");
      setError("Could not load audio. Check your connection.");
    });

    audioRef.current = audio;
    return audio;
  }, []);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const playChapter = useCallback(async (chapId: number) => {
    const audio = getAudio();
    setState("loading");
    setError(null);
    setChapterId(chapId);

    try {
      const result = await fetchChapterAudio(chapId, reciterRef.current);
      /* If a different chapter was requested while loading, bail */
      if (audioRef.current !== audio) return;

      audio.src = result.audioUrl;
      audio.currentTime = 0;
      setDuration(0);
      setCurrentTime(0);
      setReciterName(result.reciterName);
      await audio.play();
    } catch {
      setState("error");
      setError("Failed to fetch audio.");
    }
  }, [getAudio]);

  const pause  = useCallback(() => { audioRef.current?.pause(); }, []);
  const resume = useCallback(() => { audioRef.current?.play(); }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setState("idle");
    setCurrentTime(0);
  }, []);

  const seek = useCallback((seconds: number) => {
    if (audioRef.current) audioRef.current.currentTime = seconds;
  }, []);

  const setReciter = useCallback((id: number) => {
    setReciterIdSt(id);
    reciterRef.current = id;
    /* If currently playing, reload with new reciter */
    if (audioRef.current && chapterId !== null) {
      audioRef.current.pause();
      setState("idle");
    }
  }, [chapterId]);

  return {
    status: { state, chapterId, reciterId, currentTime, duration, reciterName, error },
    playChapter,
    pause,
    resume,
    stop,
    seek,
    setReciter,
  };
}

/* Format seconds → m:ss */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
