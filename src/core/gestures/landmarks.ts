// Shared landmark types and index constants (spec 8.2). Kept separate from the
// MediaPipe service so the FSM and its tests never import anything camera- or
// WASM-related.

export interface Landmark {
  x: number
  y: number
  z: number
}

export type Handedness = 'Left' | 'Right'

export interface HandFrame {
  landmarks: Landmark[]
  handedness: Handedness
  /** MediaPipe's detection confidence, 0..1. */
  score: number
}

export interface LandmarkFrame {
  hands: HandFrame[]
  timestampMs: number
}

// spec 8.2
export const WRIST = 0
export const THUMB_TIP = 4
export const INDEX_MCP = 5
export const INDEX_TIP = 8
export const MIDDLE_MCP = 9
export const MIDDLE_TIP = 12
export const RING_TIP = 16
export const PINKY_MCP = 17
export const PINKY_TIP = 20

export const FINGERTIPS = [INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP]
