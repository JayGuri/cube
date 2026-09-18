import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CameraDebugOverlay } from '../CameraDebugOverlay'
import { HandLandmarkerService, startCamera, stopCamera } from '../../core/gestures/HandLandmarkerService'
import { fingerCurl, pinchDistance } from '../../core/gestures/landmarkMath'
import type { LandmarkFrame } from '../../core/gestures/landmarks'
import { thresholdsFromSamples, useCalibrationStore } from '../../state/calibrationStore'

// Three-step calibration flow (spec 8.4): open palm, fist, pinch. Each step
// samples for ~2s; thresholdsFromSamples() turns the samples into thresholds
// scaled to this user's hand size and camera distance.

type Step = 'intro' | 'openPalm' | 'fist' | 'pinch' | 'done'
const SAMPLE_MS = 2000

export function Calibration() {
  const navigate = useNavigate()
  const setThresholds = useCalibrationStore((s) => s.setThresholds)

  const [step, setStep] = useState<Step>('intro')
  const [error, setError] = useState<string | null>(null)
  const [frame, setFrame] = useState<LandmarkFrame | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const serviceRef = useRef<HandLandmarkerService | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const samplesRef = useRef({ openPinch: [] as number[], closedPinch: [] as number[], openCurl: [] as number[], fistCurl: [] as number[] })

  useEffect(() => {
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
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    }
    void setup()
    return () => {
      cancelled = true
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      stopCamera(streamRef.current)
      serviceRef.current?.dispose()
    }
  }, [])

  useEffect(() => {
    const tick = () => {
      const video = videoRef.current
      const service = serviceRef.current
      if (video && service?.ready && video.readyState >= 2) {
        const f = service.detect(video, performance.now())
        if (f) {
          setFrame(f)
          const hand = f.hands[0]
          if (hand) {
            if (step === 'openPalm') {
              samplesRef.current.openPinch.push(pinchDistance(hand.landmarks))
              samplesRef.current.openCurl.push(fingerCurl(hand.landmarks))
            } else if (step === 'fist') {
              samplesRef.current.fistCurl.push(fingerCurl(hand.landmarks))
            } else if (step === 'pinch') {
              samplesRef.current.closedPinch.push(pinchDistance(hand.landmarks))
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [step])

  const advance = useCallback((next: Step) => {
    setStep(next)
  }, [])

  // Auto-advance each sampling step after SAMPLE_MS.
  useEffect(() => {
    if (step !== 'openPalm' && step !== 'fist' && step !== 'pinch') return
    const timer = setTimeout(() => {
      if (step === 'openPalm') advance('fist')
      else if (step === 'fist') advance('pinch')
      else if (step === 'pinch') {
        const patch = thresholdsFromSamples(samplesRef.current)
        setThresholds(patch)
        advance('done')
      }
    }, SAMPLE_MS)
    return () => clearTimeout(timer)
  }, [step, advance, setThresholds])

  const prompt: Record<Step, string> = {
    intro: 'We will calibrate hand gestures to your hand and lighting. Show your hand to the camera when ready.',
    openPalm: 'Show an open palm, fingers spread.',
    fist: 'Now make a fist.',
    pinch: 'Now pinch your thumb and index finger together.',
    done: 'Calibration complete.',
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#0F1117] p-6 text-[#F5F5F7]">
      <h1 className="text-2xl font-semibold">Gesture Calibration</h1>

      {error && (
        <p className="max-w-md text-center text-sm text-[#EF4444]" data-testid="calibration-error">
          {error}. You can skip calibration and use default thresholds, or mouse/keyboard control.
        </p>
      )}

      <div className="relative aspect-video w-full max-w-xl overflow-hidden rounded-xl bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          className="h-full w-full -scale-x-100 object-cover"
          playsInline
          muted
          data-testid="calibration-video"
        />
        <CameraDebugOverlay frame={frame} width={640} height={360} />
      </div>

      <p className="max-w-md text-center text-[#9A9DB0]" data-testid="calibration-prompt">
        {prompt[step]}
      </p>

      <div className="flex gap-3">
        {step === 'intro' && (
          <button
            type="button"
            className="rounded-lg bg-[#00D4FF] px-4 py-2 font-medium text-[#0F1117]"
            onClick={() => advance('openPalm')}
          >
            Start calibration
          </button>
        )}
        {step === 'done' && (
          <button
            type="button"
            className="rounded-lg bg-[#22C55E] px-4 py-2 font-medium text-[#0F1117]"
            onClick={() => navigate('/')}
          >
            Continue
          </button>
        )}
        <button
          type="button"
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#9A9DB0]"
          onClick={() => navigate('/')}
        >
          Skip
        </button>
      </div>
    </main>
  )
}
