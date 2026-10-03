import * as THREE from 'three'
import type { PuzzleMesh } from '../PuzzlePlugin'
import { pieceBox } from './dimensions'
import { createPieces, type Vec3 } from './pieces'

export { MIRROR_EXTENTS, pieceBox } from './dimensions'

export const mirrorPieceId = (home: Vec3) => `mirror-${home[0]}_${home[1]}_${home[2]}`

export function buildMirrorGeometry(): PuzzleMesh {
  return {
    pieces: createPieces().map(({ home }) => ({
      pieceId: mirrorPieceId(home),
      geometry: new THREE.BoxGeometry(...pieceBox(home).size),
      slot: home,
    })),
  }
}
