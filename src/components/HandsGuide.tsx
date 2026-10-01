import { LAYER_PUSH, type SignLayer } from '../core/gestures/signGestures'
import type { GestureStyle } from '../state/settingsStore'

// The in-app gesture key, and the live "what am I about to turn" HUD.

const SIGN_ROWS: Array<{ fingers: string; right: SignLayer; left: SignLayer }> = [
  { fingers: 'Index', right: 'R', left: 'L' },
  { fingers: 'Index + middle', right: 'U', left: 'D' },
  { fingers: 'Index + middle + ring', right: 'F', left: 'B' },
  { fingers: 'Pinky', right: 'M', left: 'E' },
  { fingers: 'Index + pinky', right: 'S', left: 'S' },
]

const ARROW = { right: '→', left: '←', up: '↑', down: '↓' }

// Which way each layer is pushed for its clockwise (unprimed) turn.
function clockwiseArrow(layer: SignLayer): string {
  const push = LAYER_PUSH[layer]
  const clockwiseIsPositive = push.positive === layer
  if (push.swipe === 'horizontal') return clockwiseIsPositive ? ARROW.right : ARROW.left
  return clockwiseIsPositive ? ARROW.up : ARROW.down
}

export function HandsKey({
  style,
  onStyleChange,
  onClose,
}: {
  style: GestureStyle
  onStyleChange: (style: GestureStyle) => void
  onClose: () => void
}) {
  return (
    <div
      className="absolute left-4 top-4 max-h-[calc(100%-2rem)] w-72 overflow-y-auto rounded-lg border border-white/10 bg-[#0F1117]/90 p-3 text-xs text-[#9A9DB0] shadow-lg backdrop-blur"
      data-testid="hands-help"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex overflow-hidden rounded-md border border-white/10">
          {(['signs', 'grab'] as const).map((s) => (
            <button
              key={s}
              type="button"
              data-testid={`gesture-style-${s}`}
              onClick={() => onStyleChange(s)}
              className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                style === s ? 'bg-[#00D4FF] text-[#0F1117]' : 'text-[#9A9DB0] hover:text-[#F5F5F7]'
              }`}
            >
              {s === 'signs' ? 'Signs' : 'Grab & twist'}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} aria-label="Hide hand-control instructions" className="hover:text-[#F5F5F7]">
          ×
        </button>
      </div>

      {style === 'signs' ? (
        <>
          <p>Show one hand. A sign picks the layer (the rest of the cube dims), then move your hand to push it.</p>
          <table className="mt-2 w-full text-left" data-testid="signs-key">
            <thead className="text-[10px] uppercase tracking-wide text-[#6B6F82]">
              <tr>
                <th className="pb-1 font-medium">Fingers up</th>
                <th className="pb-1 font-medium">Right</th>
                <th className="pb-1 font-medium">Left</th>
              </tr>
            </thead>
            <tbody>
              {SIGN_ROWS.map((row) => (
                <tr key={row.fingers} className="border-t border-white/5">
                  <td className="py-1 pr-2">{row.fingers}</td>
                  <td className="py-1 font-mono text-[#F5F5F7]">
                    {row.right} <span className="text-[#00D4FF]">{clockwiseArrow(row.right)}</span>
                  </td>
                  <td className="py-1 font-mono text-[#F5F5F7]">
                    {row.left} <span className="text-[#00D4FF]">{clockwiseArrow(row.left)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2">
            The arrow is the clockwise push; push the other way for the prime (<span className="font-mono">'</span>)
            turn. Pause, then push again for a double turn. Directions are as seen from the starting view, so lock
            the view while you solve.
          </p>
        </>
      ) : (
        <ol className="list-decimal space-y-1 pl-4">
          <li>Point at a piece on the cube and pinch thumb + index, holding briefly to grab it.</li>
          <li>Keep pinching and twist your wrist the way you'd turn that layer for real.</li>
          <li>Release near a quarter or half turn to commit; release early and it springs back.</li>
          <li>Grab an edge piece (not a corner or centre) to turn the middle slice.</li>
        </ol>
      )}

      <p className="mt-2 border-t border-white/10 pt-2">
        Open hand: move to orbit. Two open hands: spread or pinch together to zoom. Hold a closed fist still to
        lock or unlock the view (or press Space).
      </p>
    </div>
  )
}

export function SignHud({ layer, progress }: { layer: SignLayer; progress: number }) {
  const push = LAYER_PUSH[layer]
  const horizontal = push.swipe === 'horizontal'
  const notation = progress > 0 ? push.positive : progress < 0 ? push.negative : layer
  return (
    <div
      data-testid="sign-hud"
      className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-[#00D4FF]/40 bg-[#0F1117]/85 px-4 py-2"
    >
      <span className="font-mono text-2xl font-semibold text-[#F5F5F7]">{notation}</span>
      <div className={`relative bg-white/10 ${horizontal ? 'h-1.5 w-28' : 'h-10 w-1.5'} rounded-full`}>
        <div
          className="absolute rounded-full bg-[#00D4FF]"
          style={
            horizontal
              ? { top: 0, bottom: 0, left: progress >= 0 ? '50%' : `${50 + progress * 50}%`, width: `${Math.abs(progress) * 50}%` }
              : { left: 0, right: 0, bottom: progress >= 0 ? '50%' : `${50 + progress * 50}%`, height: `${Math.abs(progress) * 50}%` }
          }
        />
      </div>
      <span className="text-xs text-[#9A9DB0]">{horizontal ? '← push →' : '↑ push ↓'}</span>
    </div>
  )
}
