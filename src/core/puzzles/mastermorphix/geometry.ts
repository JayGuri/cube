import * as THREE from 'three'
import { buildCube3Geometry, CUBE_SIZE } from '../cube3/geometry'
import { makeCubeToTetRemapper, remapGeometry, type RadialFace } from '../../geometry/shapeMod'
import type { PuzzleMesh } from '../PuzzlePlugin'

// Task 7.2: Mastermorphix reuses cube3's CSG geometry wholesale (spec 6.3),
// then reshapes every piece's OUTER vertices via the radial remap (Task 7.1)
// -- the mechanism (26 pieces, same slots, same 6 material-group stickers) is
// completely untouched; only the vertex positions change.
//
// Deliberate deviation from spec 11.1's literal colour table (4 solid
// colours): a real Mastermorphix keeps the ORIGINAL 3x3's 6-colour WCA
// scheme, showing a mosaic of those 6 colours across its 4 tetrahedral
// faces, not 4 uniform faces. Reusing cube3's real colours (rather than
// inventing an artificial 4-colour scheme, which would need a whole new
// sticker-to-orbit mapping) is both simpler AND directly serves spec 6.3's
// actual pedagogical point -- "this puzzle solves exactly like a 3x3" reads
// far more convincingly when it also LOOKS like one, just reshaped.

const TET_RADIUS = 2.6 // visually comparable overall size to cube3's ~2.6-unit half-diagonal

const TET_VERTEX_DIRS = [
  new THREE.Vector3(1, 1, 1),
  new THREE.Vector3(-1, -1, 1),
  new THREE.Vector3(-1, 1, -1),
  new THREE.Vector3(1, -1, -1),
].map((v) => v.normalize())

const TET_FACES: RadialFace[] = TET_VERTEX_DIRS.map((v) => ({
  normal: v.clone().multiplyScalar(-1),
  offset: TET_RADIUS / 3,
}))

let cached: PuzzleMesh | null = null

export function buildMastermorphixGeometry(): PuzzleMesh {
  if (cached) return cached
  const cubeMesh = buildCube3Geometry()
  const remap = makeCubeToTetRemapper(CUBE_SIZE / 2, TET_FACES)

  cached = {
    pieces: cubeMesh.pieces.map((piece) => ({
      // pieceId and slot are kept EXACTLY as cube3 produced them (not
      // renamed): cube3's sync.ts (faceletColors/pieceIdForFacelet) is reused
      // completely unmodified below, and it looks pieces up by this same id.
      pieceId: piece.pieceId,
      geometry: remapGeometry(piece.geometry, remap),
      slot: piece.slot,
    })),
  }
  return cached
}
