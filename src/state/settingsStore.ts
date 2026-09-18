import { create } from 'zustand'

// spec 10/11.1: localStorage-persisted app-wide settings, distinct from
// per-user gesture calibration (calibrationStore) which has its own store.

export type InputModePreference = 'mouse' | 'hands'

export interface SettingsState {
  colorblindPalette: boolean
  reducedMotion: boolean
  defaultInputMode: InputModePreference
  gestureSensitivity: number // 0..1, scales pinch/fist threshold looseness
  setColorblindPalette: (on: boolean) => void
  setReducedMotion: (on: boolean) => void
  setDefaultInputMode: (mode: InputModePreference) => void
  setGestureSensitivity: (value: number) => void
}

const STORAGE_KEY = 'handcube.settings.v1'

interface StoredSettings {
  colorblindPalette: boolean
  reducedMotion: boolean
  defaultInputMode: InputModePreference
  gestureSensitivity: number
}

const DEFAULTS: StoredSettings = {
  colorblindPalette: false,
  reducedMotion: false,
  defaultInputMode: 'mouse',
  gestureSensitivity: 0.5,
}

function load(): StoredSettings {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<StoredSettings>) }
  } catch {
    return DEFAULTS
  }
}

function persist(settings: StoredSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // A full or blocked storage quota must not break the app.
  }
}

const initial = load()

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...initial,
  setColorblindPalette: (on) => {
    persist({ ...get(), colorblindPalette: on })
    set({ colorblindPalette: on })
  },
  setReducedMotion: (on) => {
    persist({ ...get(), reducedMotion: on })
    set({ reducedMotion: on })
  },
  setDefaultInputMode: (mode) => {
    persist({ ...get(), defaultInputMode: mode })
    set({ defaultInputMode: mode })
  },
  setGestureSensitivity: (value) => {
    const clamped = Math.min(1, Math.max(0, value))
    persist({ ...get(), gestureSensitivity: clamped })
    set({ gestureSensitivity: clamped })
  },
}))
