"use client"

import { useLayoutEffect, useMemo, useRef } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { RoundedBox } from "@react-three/drei"
import * as THREE from "three"
import {
  COLOR_HEX,
  HOMES,
  PLAYER_COLORS,
  SAFE,
  STARTS,
  TRACK,
  YARDS,
  YARD_SLOTS,
  cellFor,
  type PlayerColor,
} from "@/lib/ludo/board"
import type { Piece } from "@/lib/ludo/engine"

const CREAM = "#f4ead7"
const TILE = "#fffdf8"
const INK = "#2c2116"
const NEST = "#fffaf2"
const WOOD = "#6a4122"
const WOOD_DEEP = "#3a2414"

const PIP_AT: Record<number, Array<[number, number]>> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
}

function cellKey(row: number, col: number) {
  return `${row},${col}`
}

function toWorld(row: number, col: number): [number, number] {
  return [col - 7, row - 7]
}

function makeStar(size: number) {
  const shape = new THREE.Shape()
  const spikes = 5
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? size : size * 0.42
    const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
}

const STAR = makeStar(0.2)

const START_COLOR = new Map<string, PlayerColor>(
  STARTS.map((index, player) => [cellKey(TRACK[index][0], TRACK[index][1]), PLAYER_COLORS[player]]),
)

type Tile = {
  key: string
  row: number
  col: number
  color: string
  start: boolean
  safe: boolean
}

function buildTiles(): Tile[] {
  const tiles: Tile[] = TRACK.map(([row, col], index) => {
    const start = START_COLOR.get(cellKey(row, col))
    return {
      key: `track-${index}`,
      row,
      col,
      color: start ? COLOR_HEX[start] : TILE,
      start: Boolean(start),
      safe: SAFE.has(index),
    }
  })
  HOMES.forEach((cells, player) => {
    cells.forEach(([row, col], step) => {
      tiles.push({
        key: `home-${player}-${step}`,
        row,
        col,
        color: COLOR_HEX[PLAYER_COLORS[player]],
        start: false,
        safe: false,
      })
    })
  })
  return tiles
}

const TILES = buildTiles()

function centerGeometry() {
  const faces: Array<{ color: string; points: [number, number, number][] }> = [
    { color: COLOR_HEX.green, points: [[0, 0, 0], [-1.5, 0, 0], [0, 0, -1.5]] },
    { color: COLOR_HEX.yellow, points: [[0, 0, 0], [0, 0, -1.5], [1.5, 0, 0]] },
    { color: COLOR_HEX.blue, points: [[0, 0, 0], [1.5, 0, 0], [0, 0, 1.5]] },
    { color: COLOR_HEX.red, points: [[0, 0, 0], [0, 0, 1.5], [-1.5, 0, 0]] },
  ]
  return faces.map((face) => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(face.points.flat(), 3))
    geometry.computeVertexNormals()
    return { color: face.color, geometry }
  })
}

const CENTER = centerGeometry()

function CenterMark() {
  return (
    <group position={[0, 0.23, 0]}>
      {CENTER.map((wedge) => (
        <mesh key={wedge.color} geometry={wedge.geometry} receiveShadow>
          <meshStandardMaterial color={wedge.color} roughness={0.55} metalness={0.04} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.04, 28]} />
        <meshStandardMaterial color={NEST} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.03, 20]} />
        <meshStandardMaterial color="#e4c36a" roughness={0.35} metalness={0.2} />
      </mesh>
    </group>
  )
}

function Yard({ color, row, col }: { color: string; row: number; col: number }) {
  const [x, z] = toWorld(row + 2.5, col + 2.5)
  return (
    <group position={[x, 0, z]}>
      <RoundedBox args={[5.92, 0.1, 5.92]} radius={0.08} position={[0, 0.17, 0]} receiveShadow>
        <meshStandardMaterial color={color} roughness={0.62} />
      </RoundedBox>
      <RoundedBox args={[4.35, 0.06, 4.35]} radius={0.12} position={[0, 0.24, 0]} receiveShadow>
        <meshStandardMaterial color={NEST} roughness={0.48} />
      </RoundedBox>
      {YARD_SLOTS.map(([dr, dc]) => {
        const [sx, sz] = toWorld(row + dr, col + dc)
        return (
          <mesh key={`${dr}-${dc}`} position={[sx - x, 0.28, sz - z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.28, 0.4, 28]} />
            <meshStandardMaterial color={color} roughness={0.5} side={THREE.DoubleSide} />
          </mesh>
        )
      })}
    </group>
  )
}

function TrackTile({ tile }: { tile: Tile }) {
  const [x, z] = toWorld(tile.row, tile.col)
  return (
    <group position={[x, 0.2, z]}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[0.92, 0.08, 0.92]} />
        <meshStandardMaterial color={tile.color} roughness={0.58} />
      </mesh>
      {tile.start ? (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.18, 0.3, 28]} />
          <meshStandardMaterial color={NEST} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
      {tile.safe && !tile.start ? (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={STAR}>
          <meshStandardMaterial color={INK} roughness={0.45} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
    </group>
  )
}

function Pawn({
  piece,
  row,
  col,
  offsetX,
  offsetZ,
  playable,
  reduceMotion,
  onPick,
}: {
  piece: Piece
  row: number
  col: number
  offsetX: number
  offsetZ: number
  playable: boolean
  reduceMotion: boolean
  onPick: (id: string) => void
}) {
  const group = useRef<THREE.Group>(null)
  const place = useRef(new THREE.Vector3())
  const ready = useRef(false)
  const [x, z] = toWorld(row, col)
  const color = COLOR_HEX[PLAYER_COLORS[piece.player]]
  const yard = piece.pos < 0

  useFrame(({ clock }, delta) => {
    if (!group.current) return
    const bob = playable && !reduceMotion ? Math.sin(clock.elapsedTime * 4 + x) * 0.045 : 0
    const targetY = (yard ? 0.36 : 0.28) + (playable ? 0.05 : 0) + bob
    const target = place.current
    const nextX = x + offsetX
    const nextZ = z + offsetZ
    if (!ready.current || reduceMotion) {
      target.set(nextX, targetY, nextZ)
      ready.current = true
    } else {
      const step = 1 - Math.exp(-9 * delta)
      target.x += (nextX - target.x) * step
      target.y += (targetY - target.y) * step
      target.z += (nextZ - target.z) * step
    }
    group.current.position.copy(target)
  })

  return (
    <group
      ref={group}
      onClick={(event) => {
        event.stopPropagation()
        if (playable) onPick(piece.id)
      }}
      onPointerOver={(event) => {
        if (!playable) return
        event.stopPropagation()
        document.body.style.cursor = "pointer"
      }}
      onPointerOut={() => {
        document.body.style.cursor = ""
      }}
    >
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.36, 12, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {playable ? (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.42, 28]} />
          <meshStandardMaterial color="#fffaf2" emissive="#e4c36a" emissiveIntensity={0.35} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.26, 0.1, 24]} />
        <meshStandardMaterial color={color} roughness={0.38} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.14, 0.14, 20]} />
        <meshStandardMaterial color={color} roughness={0.38} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow>
        <sphereGeometry args={[0.15, 24, 18]} />
        <meshStandardMaterial color={color} roughness={0.32} metalness={0.1} emissive={playable ? color : "#000"} emissiveIntensity={playable ? 0.18 : 0} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.045, 14, 12]} />
        <meshStandardMaterial color={NEST} roughness={0.3} />
      </mesh>
    </group>
  )
}

const DIE = 1.22

/** front +Z, right +X, back -Z, left -X. Opposites sum to 7. */
const DIE_SIDES: Record<number, [number, number, number, number]> = {
  1: [2, 3, 5, 4],
  2: [6, 3, 1, 4],
  3: [6, 2, 1, 5],
  4: [5, 1, 2, 6],
  5: [4, 1, 3, 6],
  6: [2, 3, 5, 4],
}

function pipSpots(value: number, axis: "x" | "z", sign: 1 | -1) {
  const spots = PIP_AT[value] ?? PIP_AT[1]
  const lift = DIE / 2 + 0.03
  const gap = 0.26
  const radius = 0.055
  return spots.map(([u, v], index) => {
    const position: [number, number, number] =
      axis === "z"
        ? [u * gap, -v * gap, sign * lift]
        : [sign * lift, -v * gap, -u * gap * sign]
    return { key: `${axis}${sign}-${index}`, position, radius }
  })
}

function resultPips(value: number) {
  const spots = PIP_AT[value] ?? PIP_AT[1]
  const y = DIE / 2 + 0.03
  const gap = 0.36
  const radius = value === 1 ? 0.18 : 0.12
  return spots.map(([u, v], index) => ({
    key: `top-${index}`,
    position: [u * gap, y, v * gap] as [number, number, number],
    radius,
  }))
}

function Die({
  seat,
  color,
  value,
  tumbling,
  enabled,
  reduceMotion,
  onRoll,
}: {
  seat: number
  color: string
  value: number | null
  tumbling: number | null
  enabled: boolean
  reduceMotion: boolean
  onRoll: () => void
}) {
  const group = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const [row, col] = YARDS[seat]
  const [x, z] = toWorld(row + 2.5, col + 2.5)
  const face = tumbling ?? value ?? 6
  const [front, right, back, left] = DIE_SIDES[face] ?? DIE_SIDES[6]
  const pips = [
    ...pipSpots(front, "z", 1),
    ...pipSpots(back, "z", -1),
    ...pipSpots(right, "x", 1),
    ...pipSpots(left, "x", -1),
  ]
  const result = resultPips(face)

  useFrame(({ clock }, delta) => {
    if (!group.current || !body.current) return
    const pulse = enabled && !reduceMotion ? 1 + Math.sin(clock.elapsedTime * 3) * 0.04 : 1
    group.current.scale.setScalar(pulse)
    const tiltX = 0.16
    const tiltY = 0.08
    const tiltZ = -0.12
    if (tumbling != null && !reduceMotion) {
      body.current.rotation.x += delta * 14
      body.current.rotation.y += delta * 11
      body.current.rotation.z += delta * 8
    } else if (reduceMotion) {
      body.current.rotation.set(tiltX, tiltY, tiltZ)
    } else {
      const step = 1 - Math.exp(-7 * delta)
      body.current.rotation.x += (tiltX - body.current.rotation.x) * step
      body.current.rotation.y += (tiltY - body.current.rotation.y) * step
      body.current.rotation.z += (tiltZ - body.current.rotation.z) * step
    }
  })

  return (
    <group
      ref={group}
      position={[x, 0.36, z]}
      onClick={(event) => {
        event.stopPropagation()
        if (enabled) onRoll()
      }}
      onPointerOver={(event) => {
        if (!enabled) return
        event.stopPropagation()
        document.body.style.cursor = "pointer"
      }}
      onPointerOut={() => {
        document.body.style.cursor = ""
      }}
    >
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.95, 32]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.62, 28]} />
        <meshBasicMaterial color="#1a120c" transparent opacity={0.28} />
      </mesh>
      <group ref={body} position={[0, 0.78, 0]}>
        <RoundedBox args={[DIE, DIE, DIE]} radius={0.14} smoothness={4}>
          <meshStandardMaterial color="#fffefb" roughness={0.42} metalness={0.04} />
        </RoundedBox>
        {pips.map((pip) => (
          <mesh key={pip.key} position={pip.position}>
            <sphereGeometry args={[pip.radius, 12, 8]} />
            <meshStandardMaterial color="#1a120c" roughness={0.35} />
          </mesh>
        ))}
        {result.map((pip) => (
          <mesh key={pip.key} position={pip.position}>
            <cylinderGeometry args={[pip.radius, pip.radius, 0.05, 24]} />
            <meshBasicMaterial color="#120e0b" />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[1.7, 1.5, 1.7]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Playground({
  pieces,
  legal,
  active,
  dice,
  onPick,
  onRoll,
  reduceMotion,
}: {
  pieces: Piece[]
  legal: string[]
  active: number[]
  dice: BoardDie[]
  onPick: (id: string) => void
  onRoll: () => void
  reduceMotion: boolean
}) {
  const rig = useRef<THREE.Group>(null)
  const intro = useRef(reduceMotion ? 1 : 0)

  const placed = useMemo(() => {
    const buckets = new Map<string, Array<{ piece: Piece; row: number; col: number }>>()
    for (const piece of pieces) {
      const slot = Number(piece.id.split("-")[1] ?? 0)
      const [row, col] = cellFor(piece.player, piece.pos, slot)
      const id = cellKey(row, col)
      const bucket = buckets.get(id) ?? []
      bucket.push({ piece, row, col })
      buckets.set(id, bucket)
    }
    return [...buckets.values()].flatMap((bucket) =>
      bucket.map((item, index) => {
        const crowded = bucket.length > 1 && item.row === 7 && item.col === 7
        const angle = (index / bucket.length) * Math.PI * 2 - Math.PI / 2
        return {
          ...item,
          offsetX: crowded ? Math.cos(angle) * 0.42 : (index - (bucket.length - 1) / 2) * 0.22,
          offsetZ: crowded ? Math.sin(angle) * 0.42 : 0,
          playable: legal.includes(item.piece.id) && active.includes(item.piece.player),
        }
      }),
    )
  }, [pieces, legal, active])

  useFrame((_, delta) => {
    if (!rig.current) return
    intro.current = Math.min(1, intro.current + delta / 0.7)
    const t = reduceMotion ? 1 : 1 - Math.pow(1 - intro.current, 3)
    const scale = 0.94 + 0.06 * t
    rig.current.scale.setScalar(scale)
    rig.current.position.y = (1 - t) * -0.35
  })

  return (
    <group ref={rig}>
      <mesh position={[0, -0.16, 0]} receiveShadow>
        <boxGeometry args={[16.55, 0.28, 16.55]} />
        <meshStandardMaterial color={WOOD} roughness={0.72} />
      </mesh>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[16.2, 0.08, 16.2]} />
        <meshStandardMaterial color={WOOD_DEEP} roughness={0.8} />
      </mesh>
      <RoundedBox args={[15.35, 0.16, 15.35]} radius={0.06} position={[0, 0.08, 0]} receiveShadow>
        <meshStandardMaterial color={CREAM} roughness={0.78} />
      </RoundedBox>
      {YARDS.map(([row, col], index) => (
        <Yard key={PLAYER_COLORS[index]} color={COLOR_HEX[PLAYER_COLORS[index]]} row={row} col={col} />
      ))}
      {TILES.map((tile) => (
        <TrackTile key={tile.key} tile={tile} />
      ))}
      <CenterMark />
      {placed.map((item) => (
        <Pawn
          key={item.piece.id}
          piece={item.piece}
          row={item.row}
          col={item.col}
          offsetX={item.offsetX}
          offsetZ={item.offsetZ}
          playable={item.playable}
          reduceMotion={reduceMotion}
          onPick={onPick}
        />
      ))}
      {dice.map((die) => (
        <Die
          key={die.seat}
          seat={die.seat}
          color={die.color}
          value={die.value}
          tumbling={die.tumbling}
          enabled={die.enabled}
          reduceMotion={reduceMotion}
          onRoll={onRoll}
        />
      ))}
    </group>
  )
}

function FrameCamera({ reduceMotion }: { reduceMotion: boolean }) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const intro = useRef(reduceMotion ? 1 : 0)

  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    camera.fov = 30
    camera.near = 0.1
    camera.far = 160
    camera.updateProjectionMatrix()
  }, [camera])

  useFrame((_, delta) => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    intro.current = Math.min(1, intro.current + delta / 0.9)
    const t = reduceMotion ? 1 : 1 - Math.pow(1 - intro.current, 3)
    const aspect = size.width / Math.max(size.height, 1)
    const half = 8.15
    const vFov = (camera.fov * Math.PI) / 180
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
    const y = (half / Math.min(Math.tan(vFov / 2), Math.tan(hFov / 2))) * (1.04 + (1 - t) * 0.1)
    camera.up.set(0, 0, -1)
    camera.position.set(0, y, 1.15)
    camera.lookAt(0, 0, 0)
  })

  return null
}

export type BoardDie = {
  seat: number
  color: string
  value: number | null
  tumbling: number | null
  enabled: boolean
  label: string
}

export function BoardCanvas({
  pieces,
  legal,
  active,
  dice,
  onPick,
  onRoll,
  reduceMotion,
}: {
  pieces: Piece[]
  legal: string[]
  active: number[]
  dice: BoardDie[]
  onPick: (id: string) => void
  onRoll: () => void
  reduceMotion: boolean
}) {
  return (
    <Canvas
      shadows="basic"
      dpr={[1, 1.5]}
      camera={{ position: [0, 24, 14], fov: 32, near: 0.1, far: 80 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      onPointerMissed={() => {
        document.body.style.cursor = ""
      }}
    >
      <color attach="background" args={["#4a2c18"]} />
      <hemisphereLight args={["#fff6e4", "#3a2414", 0.85]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[7, 16, 8]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={2}
        shadow-camera-far={40}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0008}
      />
      <Playground
        pieces={pieces}
        legal={legal}
        active={active}
        dice={dice}
        onPick={onPick}
        onRoll={onRoll}
        reduceMotion={reduceMotion}
      />
      <FrameCamera reduceMotion={reduceMotion} />
    </Canvas>
  )
}
