import type { FaceColorMap } from './PuzzlePlugin'

// Task 10.1: an alternate high-contrast palette (spec 11.1) using the
// Okabe-Ito colorblind-safe qualitative set. Substitution is by hex value, not
// by face name, so it works unchanged for every puzzle's colorScheme -- a new
// puzzle's colours only need adding here once, not a second toggle wired up
// per puzzle.
const SUBSTITUTIONS: Record<string, string> = {
  '#FFFFFF': '#FFFFFF', // white -- neutral, unchanged
  '#FFD500': '#F0E442', // yellow -> Okabe-Ito yellow
  '#009E60': '#009E73', // green -> Okabe-Ito bluish green
  '#0051BA': '#0072B2', // blue -> Okabe-Ito blue
  '#C41E3A': '#CC79A7', // red -> Okabe-Ito reddish purple (off the red/green axis)
  '#FF5800': '#E69F00', // orange -> Okabe-Ito orange
  '#A0A0A0': '#A0A0A0', // grey -- neutral, unchanged
  '#6F2DA8': '#6F2DA8', // purple -- already distinguishable
  '#4AA8D8': '#56B4E9', // light blue -> Okabe-Ito sky blue
  '#EC008C': '#CC79A7', // magenta -> same reddish purple as red substitute
  '#145A32': '#004D40', // dark green -> darker teal, away from red/green axis
  '#F5DEB3': '#F5DEB3', // beige -- neutral, unchanged
}

export function applyColorblindPalette(colorScheme: FaceColorMap): FaceColorMap {
  const out: FaceColorMap = {}
  for (const [key, hex] of Object.entries(colorScheme)) {
    out[key] = SUBSTITUTIONS[hex.toUpperCase()] ?? hex
  }
  return out
}

export function applyColorblindPaletteToColors(colors: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, hex] of Object.entries(colors)) {
    out[key] = SUBSTITUTIONS[hex.toUpperCase()] ?? hex
  }
  return out
}
