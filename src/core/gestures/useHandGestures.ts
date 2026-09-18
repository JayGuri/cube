import { useEffect, useRef, useState, type RefObject } from 'react'
import { HandLandmarkerService, startCamera, stopCamera } from './HandLandmarkerService'
import { fingerCurl } from './landmarkMath'
import type { HandFrame, LandmarkFrame } from './landmarks'
import {
  createInitialGestureState,
  stepGesture,
  type GestureEvent,
  type GestureState,
  type GestureThresholds,
} from './GestureRecognizer'

// Task 4.5: connects a live camera through HandLandmarkerService and the pure
// gesture FSM. Everything below this hook (the FSM itself) is unit-tested
// without a camera; this hook is the thin, inherently-manual-test seam that
// wires it to a real getUserMedia stream (spec 8.1/12.2).

export interface GestureTick {
  seq: number
  events: GestureEvent[]
  // Normalised (0..1, mirrored) position of the actuator hand's index
  // fingertip, for the caller to raycast against its own scene, or null when
  // no actuator hand is present this tick.
  cursor: { x: number; y: number } | null
}

export interface UseHandGesturesOptions {
  enabled: boolean
  thresholds: GestureThresholds
  // Gesture state updates are throttled independently of the render loop
  // (spec 12.2); the render loop itself must stay uncapped.
  targetFps?: number
}

export interface UseHandGesturesResult {
  videoRef: RefObject<HTMLVideoElement | null>
  frame: LandmarkFrame | null
  gestureState: GestureState
  tick: GestureTick | null
  error: string | null
  ready: boolean
}

// The actuator is whichever hand is not curled into a fist; with one hand
// present, that hand is the actuator by default.
function pickActuator(hands: HandFrame[], fistThreshold: number): HandFrame | null {
  if (hands.length === 0) return null
  if (hands.length === 1) return hands[0]
  return hands.find((h) => fingerCurl(h.landmarks) >= fistThreshold) ?? hands[0]
}

export function useHandGestures(options: UseHandGesturesOptions): UseHandGesturesResult {
  const { enabled, thresholds, targetFps = 25 } = options

  const videoRef = useRef<HTMLVideoElement>(null)
  const serviceRef = useRef<HandLandmarkerService | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const gestureStateRef = useRef<GestureState>(createInitialGestureState())
  const lastTickAtRef = useRef(0)
  const seqRef = useRef(0)

  const [frame, setFrame] = useState<LandmarkFrame | null>(null)
  const [tick, setTick] = useState<GestureTick | null>(null)
  const [gestureState, setGestureState] = useState<GestureState>(gestureStateRef.current)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function setup() {
      try {
        const service = new HandLandmarkerService()
        await service.init()
        const stream = await startCamera()
        if (cancelled) {
          stopCamera(stream)
          return
        }
        serviceRef.current = service
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setReady(true)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    }
    void setup()

    return () => {
      cancelled = true
      setReady(false)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      stopCamera(streamRef.current)
      streamRef.current = null
      serviceRef.current?.dispose()
      serviceRef.current = null
      gestureStateRef.current = createInitialGestureState()
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const minIntervalMs = 1000 / targetFps

    const loop = () => {
      const now = performance.now()
      const video = videoRef.current
      const service = serviceRef.current
      if (video && service?.ready && video.readyState >= 2 && now - lastTickAtRef.current >= minIntervalMs) {
        lastTickAtRef.current = now
        const f = service.detect(video, now)
        if (f) {
          setFrame(f)
          const result = stepGesture(gestureStateRef.current, f, thresholds)
          gestureStateRef.current = result.nextState
          setGestureState(result.nextState)

          const actuator = pickActuator(f.hands, thresholds.fist)
          const cursor = actuator
            ? { x: 1 - actuator.landmarks[8].x, y: actuator.landmarks[8].y }
            : null

          seqRef.current += 1
          setTick({ seq: seqRef.current, events: result.events, cursor })
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [enabled, thresholds, targetFps])

  return { videoRef, frame, gestureState, tick, error, ready }
}

// Re-exported for callers that only need the pure selection rule (e.g. tests).
export { pickActuator }
