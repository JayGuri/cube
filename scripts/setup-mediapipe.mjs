// Copies the MediaPipe WASM runtime out of node_modules into public/ so the app
// self-hosts it (spec 8.1) without committing ~34MB of binaries to git.
//
// Runs on postinstall and before dev/build, so the served runtime can never
// drift from the installed @mediapipe/tasks-vision version. The .task model is
// committed instead: it is not on npm, and Google moves its download URLs.
import { cp, mkdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const from = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm')
const to = resolve(root, 'public/mediapipe/wasm')

try {
  await stat(from)
} catch {
  console.warn('[setup-mediapipe] @mediapipe/tasks-vision not installed yet; skipping.')
  process.exit(0)
}

await mkdir(dirname(to), { recursive: true })
await cp(from, to, { recursive: true })
console.log(`[setup-mediapipe] copied WASM runtime -> ${to}`)
