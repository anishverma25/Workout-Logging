import { useSyncExternalStore } from 'react';

/**
 * Settings that belong to this device rather than the account: whether this phone beeps,
 * buzzes or stays awake. Kept in local storage; never synced.
 */
export interface DeviceSettings {
  restSound: boolean;
  restVibrate: boolean;
  keepAwake: boolean;
}

const KEY = 'overload.device';
const DEFAULTS: DeviceSettings = { restSound: true, restVibrate: true, keepAwake: true };
const listeners = new Set<() => void>();
let cache: DeviceSettings | null = null;

function read(): DeviceSettings {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as object) };
  } catch {
    cache = DEFAULTS;
  }
  return cache;
}

export function getDeviceSettings(): DeviceSettings {
  return read();
}

export function setDeviceSetting<K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]) {
  cache = { ...read(), [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Private windows may refuse storage; the setting still applies until reload.
  }
  listeners.forEach((l) => l());
}

export function useDeviceSettings(): DeviceSettings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => DEFAULTS,
  );
}

let audio: AudioContext | null = null;

/** Two short tones. The audio context is created on first use, after a tap has unlocked it. */
export function playRestTone() {
  try {
    audio ??= new AudioContext();
    const start = audio.currentTime;
    for (const [offset, freq] of [
      [0, 880],
      [0.22, 1175],
    ] as const) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.18);
      osc.connect(gain).connect(audio.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.2);
    }
  } catch {
    // No audio on this device: the buzz and the on-screen timer still show it.
  }
}

/** Browsers only allow audio after a tap; call this from one so the rest tone can play. */
export function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    // Ignored: audio is optional.
  }
}
