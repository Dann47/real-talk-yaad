/**
 * Microphone recording shared by Voice chat and Record lines.
 * Handles permission, the start/stop race (letting go before the mic is ready),
 * and a live level for the meter.
 */
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import { levelFromDecibels } from '@/components/level-meter';

export const METER_BARS = 28;
/** Readings below this count as silence. */
export const QUIET_LEVEL = 0.12;

export type MicPhase = 'idle' | 'starting' | 'recording' | 'stopping';

/** A finished recording. `waveform` is its loudness shape (0–1), ready to draw. */
export type Take = { uri: string; duration: number; loudest: number; waveform: number[] };

/** Number of bars in a take's waveform. */
export const WAVEFORM_BARS = 48;

/** Squeezes a list of readings into `bars` evenly spaced peaks. */
function shape(readings: number[], bars = WAVEFORM_BARS): number[] {
  if (!readings.length) return Array(bars).fill(0);
  return Array.from({ length: bars }, (_, i) => {
    const from = Math.floor((i / bars) * readings.length);
    const to = Math.max(from + 1, Math.floor(((i + 1) / bars) * readings.length));
    return Math.max(...readings.slice(from, to));
  });
}

export function useRecorder() {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const status = useAudioRecorderState(recorder, 100);

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [phase, setPhaseState] = useState<MicPhase>('idle');
  const [levels, setLevels] = useState<number[]>(() => Array(METER_BARS).fill(0));
  const phaseRef = useRef<MicPhase>('idle');
  const starting = useRef<Promise<boolean> | null>(null);
  const loudest = useRef(0);
  const history = useRef<number[]>([]);

  const setPhase = (next: MicPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  };

  useEffect(() => {
    AudioModule.requestRecordingPermissionsAsync()
      .then((result) => setAllowed(result.granted))
      .catch(() => setAllowed(false));
  }, []);

  const level = phase === 'recording' ? levelFromDecibels(status.metering) : 0;

  useEffect(() => {
    if (phase !== 'recording') return;
    loudest.current = Math.max(loudest.current, level);
    history.current.push(level);
    setLevels((prev) => [...prev.slice(1), level]);
  }, [phase, level, status.durationMillis]);

  /** Starts recording. Resolves false if the microphone could not start. */
  const start = useCallback(async (): Promise<boolean> => {
    if (phaseRef.current !== 'idle') return false;
    setLevels(Array(METER_BARS).fill(0));
    loudest.current = 0;
    history.current = [];
    setPhase('starting');
    starting.current = (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        setPhase('recording');
        return true;
      } catch {
        setPhase('idle');
        return false;
      }
    })();
    return starting.current;
  }, [recorder]);

  /** Stops recording and returns the take. Safe to call while the mic is still starting. */
  const finish = useCallback(async (): Promise<Take | null> => {
    const started = await (starting.current ?? Promise.resolve(phaseRef.current === 'recording'));
    starting.current = null;
    if (!started || phaseRef.current !== 'recording') {
      setPhase('idle');
      return null;
    }
    const duration = recorder.getStatus().durationMillis;
    setPhase('stopping');
    try {
      await recorder.stop();
    } catch {
      // Already stopped: use whatever file exists.
    }
    // Recording mode off, so playback uses the loudspeaker rather than the earpiece.
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    setPhase('idle');
    return recorder.uri
      ? { uri: recorder.uri, duration, loudest: loudest.current, waveform: shape(history.current) }
      : null;
  }, [recorder]);

  /** Stops and throws the take away. */
  const cancel = useCallback(async () => {
    await finish();
    setLevels(Array(METER_BARS).fill(0));
  }, [finish]);

  return {
    allowed,
    phase,
    recording: phase === 'recording',
    busy: phase === 'starting' || phase === 'stopping',
    durationMillis: phase === 'recording' ? status.durationMillis : 0,
    level,
    levels,
    loudest: loudest.current,
    start,
    finish,
    cancel,
  };
}

export function clock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
