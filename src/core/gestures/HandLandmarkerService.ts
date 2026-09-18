import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision'
import type { Handedness, LandmarkFrame } from './landmarks'

// Thin wrapper over MediaPipe (spec 8.1). Everything downstream consumes the
// plain LandmarkFrame shape instead of MediaPipe types, which is what keeps the
// gesture FSM testable without this file, a camera, or WASM.

const WASM_PATH = '/mediapipe/wasm'
const MODEL_PATH = '/models/hand_landmarker.task'

export class HandLandmarkerService {
  private landmarker: HandLandmarker | null = null
  private lastTimestamp = -1

  async init(): Promise<void> {
    if (this.landmarker) return
    // Both the runtime and the model are served from our own origin, so the app
    // keeps working offline after first load and never depends on a CDN.
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH)
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
    })
  }

  get ready(): boolean {
    return this.landmarker !== null
  }

  /** Runs detection for one video frame and converts it to a LandmarkFrame. */
  detect(video: HTMLVideoElement, timestampMs: number): LandmarkFrame | null {
    if (!this.landmarker) return null
    // MediaPipe rejects a timestamp that does not advance; a paused or stalled
    // video replays the same one, so skip rather than throw.
    if (timestampMs <= this.lastTimestamp) return null
    this.lastTimestamp = timestampMs
    return toLandmarkFrame(this.landmarker.detectForVideo(video, timestampMs), timestampMs)
  }

  dispose(): void {
    this.landmarker?.close()
    this.landmarker = null
    this.lastTimestamp = -1
  }
}

export function toLandmarkFrame(
  result: HandLandmarkerResult,
  timestampMs: number,
): LandmarkFrame {
  const hands = (result.landmarks ?? []).map((landmarks, i) => {
    const category = result.handedness?.[i]?.[0]
    return {
      landmarks: landmarks.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      handedness: (category?.categoryName === 'Left' ? 'Left' : 'Right') as Handedness,
      score: category?.score ?? 0,
    }
  })
  return { hands, timestampMs }
}

/** Starts the webcam. Requires HTTPS or localhost (spec 2). */
export async function startCamera(deviceId?: string): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser exposes no camera API. Camera access needs HTTPS.')
  }
  return navigator.mediaDevices.getUserMedia({
    video: deviceId
      ? { deviceId: { exact: deviceId } }
      : { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
    audio: false,
  })
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop())
}
