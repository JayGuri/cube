import { create } from 'zustand'

// App-wide settings, persisted in localStorage.

export type InputModePreference = 'mouse' | 'hands'

export interface SettingsState {
  colorblindPalette: boolean
  defaultInputMode: InputModePreference
  swapHands: boolean
  setColorblindPalette: (on: boolean) => void
  setDefaultInputMode: (mode: InputModePreference) => void
  setSwapHands: (on: boolean) => void
}

const STORAGE_KEY = 'cubit.settings.v1'

interface StoredSettings {
  colorblindPalette: boolean
  defaultInputMode: InputModePreference
  swapHands: boolean
}

const DEFAULTS: StoredSettings = {
  colorblindPalette: false,
  defaultInputMode: 'mouse',
  swapHands: false,
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
  setDefaultInputMode: (mode) => {
    persist({ ...get(), defaultInputMode: mode })
    set({ defaultInputMode: mode })
  },
  setSwapHands: (on) => {
    persist({ ...get(), swapHands: on })
    set({ swapHands: on })
  },
}))
