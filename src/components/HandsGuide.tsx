import { POSE_FOR, signForNotation, type ActiveSign, type SignLayer } from '../core/gestures/signGestures'
import { describeStep, type GuideState } from '../core/solvers/solveGuide'
import type { GestureStyle } from '../state/settingsStore'

// The in-app gesture key, the live "about to turn" HUD, and the guided-solve
// panel.

const FINGER_NAMES = ['index', 'middle', 'ring', 'pinky']

/** "index + middle" -- the fingers held up for a layer's sign. */
function poseWords(layer: SignLayer): string {
  return FINGER_NAMES.filter((_, i) => POSE_FOR[layer][i] === '1').join(' + ')
}

/** Four little fingers, raised or folded, drawn as the back of a right hand. */
function PoseIcon({ layer, size = 22 }: { layer: SignLayer; size?: number }) {
  const pose = POSE_FOR[layer]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label={poseWords(layer)} className="shrink-0">
      <rect x="4" y="13" width="16" height="9" rx="3" fill="#2A2E3D" />
      {[0, 1, 2, 3].map((i) => {
        const up = pose[i] === '1'
        return (
          <rect
            key={i}
            x={5 + i * 4}
            y={up ? 2 : 10}
            width="3"
            height={up ? 12 : 4}
            rx="1.5"
            fill={up ? '#00D4FF' : '#4A4F63'}
          />
        )
      })}
    </svg>
  )
}

const LAYERS: Array<{ layer: SignLayer; name: string }> = [
  { layer: 'R', name: 'Right' },
  { layer: 'U', name: 'Top' },
  { layer: 'F', name: 'Front' },
  { layer: 'L', name: 'Left' },
  { layer: 'D', name: 'Bottom' },
  { layer: 'B', name: 'Back' },
  { layer: 'M', name: 'Middle slice' },
  { layer: 'E', name: 'Equator slice' },
  { layer: 'S', name: 'Standing slice' },
]

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
          <p className="text-[#F5F5F7]">
            Use both hands. The <b>fingers</b> pick the layer, the <b>hand</b> picks the direction:
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-md border border-white/10 py-1.5">
              <div className="text-[#F5F5F7]">Right hand</div>
              <div>clockwise ↻</div>
            </div>
            <div className="rounded-md border border-white/10 py-1.5">
              <div className="text-[#F5F5F7]">Left hand</div>
              <div>counter-clockwise ↺</div>
            </div>
          </div>
          <p className="mt-2">Hold the sign still until the ring fills. Relax your hand, then sign again to repeat.</p>
          <ul className="mt-2 space-y-1" data-testid="signs-key">
            {LAYERS.map(({ layer, name }) => (
              <li key={layer} className="flex items-center gap-2 border-t border-white/5 pt-1">
                <PoseIcon layer={layer} />
                <span className="w-5 font-mono text-sm text-[#F5F5F7]">{layer}</span>
                <span className="flex-1">{name}</span>
                <span className="text-[10px] text-[#6B6F82]">{poseWords(layer)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px]">
            Tip: R, U, F count fingers from the index side (1, 2, 3); L, D, B count from the pinky side.
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

function Ring({ progress }: { progress: number }) {
  const r = 12
  const c = 2 * Math.PI * r
  return (
    <svg width={30} height={30} viewBox="0 0 30 30" aria-hidden>
      <circle cx="15" cy="15" r={r} fill="none" stroke="#ffffff1f" strokeWidth="3" />
      <circle
        cx="15"
        cy="15"
        r={r}
        fill="none"
        stroke={progress >= 1 ? '#22C55E' : '#00D4FF'}
        strokeWidth="3"
        strokeDasharray={`${progress * c} ${c}`}
        transform="rotate(-90 15 15)"
      />
    </svg>
  )
}

export function SignsHud({ signs }: { signs: ActiveSign[] }) {
  return (
    <div data-testid="sign-hud" className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-3">
      {signs.map((s) => (
        <div
          key={s.hand}
          className="flex items-center gap-2 rounded-xl border border-[#00D4FF]/40 bg-[#0F1117]/85 px-3 py-1.5"
        >
          <Ring progress={s.progress} />
          <span className="font-mono text-xl font-semibold text-[#F5F5F7]">{s.notation}</span>
          <span className="text-[10px] uppercase tracking-wide text-[#9A9DB0]">{s.hand} hand</span>
        </div>
      ))}
    </div>
  )
}

export function GuidePanel({
  guide,
  status,
  onStop,
  showHands,
}: {
  guide: GuideState | null
  status: 'solving' | 'following' | 'done'
  onStop: () => void
  showHands: boolean
}) {
  const step = guide ? guide.steps[guide.index] : null
  const sign = step ? signForNotation(step) : null
  const upcoming = guide ? guide.steps.slice(guide.index + 1, guide.index + 7) : []
  return (
    <div
      data-testid="guide-panel"
      className="absolute bottom-4 right-4 w-72 rounded-lg border border-[#F5B83D]/40 bg-[#0F1117]/92 p-3 text-xs text-[#9A9DB0] shadow-lg backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#F5B83D]">Guided solve</span>
        <button type="button" onClick={onStop} className="hover:text-[#F5F5F7]" data-testid="guide-stop">
          {status === 'done' ? 'Close' : 'Stop'}
        </button>
      </div>

      {status === 'solving' && (
        <p className="mt-2" data-testid="guide-solving">
          Finding the shortest solution…
        </p>
      )}

      {status === 'done' && (
        <p className="mt-2 text-sm text-[#22C55E]" data-testid="guide-done">
          Solved! Scramble again for another one.
        </p>
      )}

      {status === 'following' && guide && step && (
        <>
          <div className="mt-2 h-1 overflow-hidden rounded bg-white/10">
            <div className="h-full bg-[#F5B83D]" style={{ width: `${(guide.index / guide.steps.length) * 100}%` }} />
          </div>
          <p className="mt-1">
            Step {guide.index + 1} of {guide.steps.length} · follow the gold arrow on the cube
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="font-mono text-4xl font-semibold text-[#F5F5F7]" data-testid="guide-step">
              {step}
            </span>
            <span className="text-sm text-[#F5F5F7]">{describeStep(step)}</span>
          </div>
          <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
            {showHands && sign && (
              <div className="flex items-center gap-2" data-testid="guide-sign">
                <PoseIcon layer={sign.layer} />
                <span>
                  <b className="text-[#F5F5F7]">{sign.hand} hand</b>: {poseWords(sign.layer)}
                </span>
              </div>
            )}
            <div>
              Keyboard:{' '}
              <kbd className="rounded bg-white/10 px-1 font-mono text-[#F5F5F7]">
                {step.endsWith("'") ? `Shift+${step[0]}` : step[0]}
              </kbd>
            </div>
          </div>
          {upcoming.length > 0 && (
            <p className="mt-2 font-mono text-[11px]">
              Then: {upcoming.join(' ')}
              {guide.steps.length - guide.index - 1 > upcoming.length ? ' …' : ''}
            </p>
          )}
        </>
      )}
    </div>
  )
}
