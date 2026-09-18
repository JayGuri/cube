import { create } from 'zustand'
import { DEFAULT_THRESHOLDS, type GestureThresholds } from '../core/gestures/GestureRecognizer'

// Calibrated thresholds, persisted so a user calibrates once (spec 8.4).

const STORAGE_KEY = 'handcube.calibration.v1'

export interface CalibrationStore {
  thresholds: GestureThresholds
  calibrated: boolean
  setThresholds: (patch: Partial<GestureThresholds>) => void
  reset: () => void
}

function load(): { thresholds: GestureThresholds; calibrated: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { thresholds: DEFAULT_THRESHOLDS, calibrated: false }
    const parsed = JSON.parse(raw) as Partial<GestureThresholds>
    // Merge over the defaults so a stored blob from an older version, missing
    // keys added since, cannot leave a threshold undefined.
    return { thresholds: { ...DEFAULT_THRESHOLDS, ...parsed }, calibrated: true }
  } catch {
    return { thresholds: DEFAULT_THRESHOLDS, calibrated: false }
  }
}

function persist(thresholds: GestureThresholds): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(thresholds))
  } catch {
    // A full or blocked storage quota must not break gesture control.
  }
}

const initial = typeof localStorage === 'undefined'
  ? { thresholds: DEFAULT_THRESHOLDS, calibrated: false }
  : load()

export const useCalibrationStore = create<CalibrationStore>((set, get) => ({
  thresholds: initial.thresholds,
  calibrated: initial.calibrated,

  setThresholds: (patch) => {
    const thresholds = { ...get().thresholds, ...patch }
    persist(thresholds)
    set({ thresholds, calibrated: true })
  },

  reset: () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    set({ thresholds: DEFAULT_THRESHOLDS, calibrated: false })
  },
}))

/**
 * Derives thresholds from samples taken during the three calibration poses
 * (spec 8.4). Each threshold sits midway between the two measured extremes, so
 * it adapts to hand size and camera distance instead of being a fixed constant.
 */
export function thresholdsFromSamples(samples: {
  openPinch: number[]
  closedPinch: number[]
  openCurl: number[]
  fistCurl: number[]
}): Partial<GestureThresholds> {
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)

  const openPinch = mean(samples.openPinch)
  const closedPinch = mean(samples.closedPinch)
  const openCurl = mean(samples.openCurl)
  const fistCurl = mean(samples.fistCurl)

  const patch: Partial<GestureThresholds> = {}
  if (Number.isFinite(openPinch) && Number.isFinite(closedPinch)) {
    patch.pinch = (openPinch + closedPinch) / 2
  }
  if (Number.isFinite(openCurl) && Number.isFinite(fistCurl)) {
    patch.fist = fistCurl + (openCurl - fistCurl) * 0.35
    patch.openPalm = fistCurl + (openCurl - fistCurl) * 0.75
  }
  return patch
}
