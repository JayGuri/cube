import type { LandmarkFrame } from '../core/gestures/landmarks'

// spec 4.4 / 10: a small live confidence readout so a user understands why a
// gesture wasn't recognized, and is prompted to improve lighting when jittery.

export interface GestureConfidenceIndicatorProps {
  frame: LandmarkFrame | null
}

export function GestureConfidenceIndicator({ frame }: GestureConfidenceIndicatorProps) {
  const hands = frame?.hands ?? []
  const bestScore = hands.reduce((max, h) => Math.max(max, h.score), 0)

  let label: string
  let colorClass: string
  if (hands.length === 0) {
    label = 'No hand detected'
    colorClass = 'text-[#9A9DB0]'
  } else if (bestScore < 0.5) {
    label = 'Low confidence - improve lighting'
    colorClass = 'text-[#F5A524]'
  } else if (bestScore < 0.8) {
    label = 'Tracking'
    colorClass = 'text-[#9A9DB0]'
  } else {
    label = 'Tracking well'
    colorClass = 'text-[#22C55E]'
  }

  return (
    <div
      data-testid="gesture-confidence"
      className={`flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-xs font-medium ${colorClass}`}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: hands.length === 0 ? '#9A9DB0' : bestScore < 0.5 ? '#F5A524' : '#22C55E' }}
      />
      {label}
    </div>
  )
}
