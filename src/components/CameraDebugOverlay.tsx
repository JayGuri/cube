import { useEffect, useRef } from 'react'
import type { LandmarkFrame } from '../core/gestures/landmarks'

// Skeleton overlay per spec 11.1: #39FF88 lines, #00D4FF joints, drawn over the
// video feed so a user can see why a gesture wasn't recognized (spec 8.1/4.3).

const CONNECTIONS: Array<[number, number]> = [
  // thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // palm
  [5, 9], [9, 13], [13, 17],
]

export interface CameraDebugOverlayProps {
  frame: LandmarkFrame | null
  width: number
  height: number
  // MediaPipe landmarks are normalised (0..1) and mirrored for a front camera.
  mirror?: boolean
}

export function CameraDebugOverlay({ frame, width, height, mirror = true }: CameraDebugOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)
    if (!frame) return

    for (const hand of frame.hands) {
      const px = (x: number) => (mirror ? 1 - x : x) * width
      const py = (y: number) => y * height

      ctx.strokeStyle = '#39FF88'
      ctx.lineWidth = 2
      for (const [a, b] of CONNECTIONS) {
        const p1 = hand.landmarks[a]
        const p2 = hand.landmarks[b]
        if (!p1 || !p2) continue
        ctx.beginPath()
        ctx.moveTo(px(p1.x), py(p1.y))
        ctx.lineTo(px(p2.x), py(p2.y))
        ctx.stroke()
      }

      ctx.fillStyle = '#00D4FF'
      for (const p of hand.landmarks) {
        ctx.beginPath()
        ctx.arc(px(p.x), py(p.y), 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [frame, width, height, mirror])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      data-testid="camera-debug-overlay"
      className="pointer-events-none absolute inset-0"
    />
  )
}
