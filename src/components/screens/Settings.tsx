import { Link } from 'react-router-dom'
import { useCalibrationStore } from '../../state/calibrationStore'
import { useSettingsStore } from '../../state/settingsStore'

const TOGGLE = (on: boolean) =>
  `h-6 w-11 rounded-full transition ${on ? 'bg-[#00D4FF]' : 'bg-white/15'} relative`
const KNOB = (on: boolean) =>
  `absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${on ? 'left-5' : 'left-0.5'}`

export function Settings() {
  const settings = useSettingsStore()
  const calibrated = useCalibrationStore((s) => s.calibrated)
  const resetCalibration = useCalibrationStore((s) => s.reset)

  return (
    <main className="min-h-dvh bg-[#0F1117] px-6 py-12 text-[#F5F5F7]">
      <div className="mx-auto max-w-xl">
        <Link to="/" className="text-sm text-[#9A9DB0] hover:text-[#F5F5F7]">
          ← All puzzles
        </Link>
        <h1 className="mt-2 text-3xl font-semibold">Settings</h1>

        <div className="mt-8 space-y-6">
          <Row
            label="Colorblind-friendly palette"
            description="Uses a high-contrast alternate palette instead of the standard WCA colours."
          >
            <button
              type="button"
              data-testid="colorblind-toggle"
              className={TOGGLE(settings.colorblindPalette)}
              onClick={() => settings.setColorblindPalette(!settings.colorblindPalette)}
            >
              <span className={KNOB(settings.colorblindPalette)} />
            </button>
          </Row>

          <Row label="Reduced motion" description="Cuts down on animation for puzzle turns and UI transitions.">
            <button
              type="button"
              data-testid="reduced-motion-toggle"
              className={TOGGLE(settings.reducedMotion)}
              onClick={() => settings.setReducedMotion(!settings.reducedMotion)}
            >
              <span className={KNOB(settings.reducedMotion)} />
            </button>
          </Row>

          <Row label="Default input mode" description="Which control scheme Free Play starts in.">
            <select
              data-testid="default-input-mode"
              value={settings.defaultInputMode}
              onChange={(e) => settings.setDefaultInputMode(e.target.value as 'mouse' | 'hands')}
              className="rounded-lg border border-white/10 bg-[#1A1D27] px-3 py-1.5 text-sm"
            >
              <option value="mouse">Mouse</option>
              <option value="hands">Hands</option>
            </select>
          </Row>

          <Row label="Gesture sensitivity" description="Looser thresholds if pinches/fists aren't registering.">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.gestureSensitivity}
              onChange={(e) => settings.setGestureSensitivity(Number(e.target.value))}
              data-testid="gesture-sensitivity"
              className="w-32"
            />
          </Row>

          <Row
            label="Gesture calibration"
            description={calibrated ? 'Calibrated to your hand.' : 'Not yet calibrated -- using defaults.'}
          >
            <div className="flex gap-2">
              <Link
                to="/calibration"
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-[#9A9DB0] hover:text-[#F5F5F7]"
              >
                Re-run
              </Link>
              {calibrated && (
                <button
                  type="button"
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-[#EF4444]"
                  onClick={resetCalibration}
                >
                  Reset
                </button>
              )}
            </div>
          </Row>
        </div>
      </div>
    </main>
  )
}

function Row({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#1A1D27] p-4">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-[#9A9DB0]">{description}</p>
      </div>
      {children}
    </div>
  )
}
