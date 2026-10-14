"use client"

import { useMemo, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { RoundedBox } from "@react-three/drei"
import * as THREE from "three"
import { CENTER, PREMIUM, SIZE, tileValue, type Cell, type Placement } from "@/lib/games/scrabble"

const SQ: Record<string, string> = { "": "#1d5a49", MT: "#c8323f", MD: "#e98a9a", LT: "#2f6fd6", LD: "#8ec5ee" }
const GOLD = "#f2c75c"
const WOOD = "#f0d9a8"

export type Scrabble3DProps = {
  board: Cell[]
  pending: Placement[]
  last: number[]
  onSquare: (i: number) => void
  lowPower: boolean
}

const pos = (i: number): [number, number] => [(i % SIZE) - 7, Math.floor(i / SIZE) - 7]

/** Texture de face d'un jeton (lettre + valeur), dessinée une fois par lettre. */
const faces = new Map<string, THREE.CanvasTexture>()
function faceFor(l: string, blank: boolean, fresh: boolean) {
  const key = `${l}${blank ? "*" : ""}${fresh ? "+" : ""}`
  let tex = faces.get(key)
  if (tex) return tex
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const grad = g.createLinearGradient(0, 0, 128, 128)
  grad.addColorStop(0, fresh ? "#fff3c4" : "#f6e3b6")
  grad.addColorStop(1, fresh ? "#f0cf74" : "#dcbc7f")
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  g.strokeStyle = "rgba(120, 80, 30, 0.35)"
  for (let y = 8; y < 128; y += 14) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(40, y + 4, 80, y - 4, 128, y + 2); g.stroke() }
  g.fillStyle = blank ? "#9b2c2c" : "#2a1a10"
  g.font = "bold 82px system-ui, sans-serif"
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.fillText(l, 58, 66)
  if (!blank) {
    g.font = "bold 30px system-ui, sans-serif"
    g.fillText(String(tileValue(l)), 106, 104)
  }
  tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  faces.set(key, tex)
  return tex
}

function Tile({ i, l, blank, fresh, onSquare }: { i: number; l: string; blank: boolean; fresh: boolean; onSquare: (i: number) => void }) {
  const [x, z] = pos(i)
  const tex = faceFor(l, blank, fresh)
  return (
    <group position={[x, fresh ? 0.16 : 0.1, z]} onClick={(e) => { e.stopPropagation(); onSquare(i) }}>
      <RoundedBox args={[0.9, 0.18, 0.9]} radius={0.06} smoothness={3} castShadow>
        <meshPhysicalMaterial color={WOOD} roughness={0.45} clearcoat={0.6} clearcoatRoughness={0.3} />
      </RoundedBox>
      <mesh position={[0, 0.092, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshStandardMaterial map={tex} roughness={0.5} emissive={fresh ? GOLD : "#000000"} emissiveIntensity={fresh ? 0.12 : 0} />
      </mesh>
    </group>
  )
}

function Square({ i, onSquare, isLast }: { i: number; onSquare: (i: number) => void; isLast: boolean }) {
  const [x, z] = pos(i)
  const [hover, setHover] = useState(false)
  const p = PREMIUM[i]
  const base = i === CENTER ? "#e98a9a" : SQ[p]
  return (
    <mesh
      position={[x, -0.05, z]}
      receiveShadow
      onClick={(e) => { e.stopPropagation(); onSquare(i) }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true) }}
      onPointerOut={() => setHover(false)}
    >
      <boxGeometry args={[0.96, 0.1, 0.96]} />
      <meshStandardMaterial color={hover ? "#3c8f74" : base} roughness={0.6} emissive={isLast ? GOLD : "#000000"} emissiveIntensity={isLast ? 0.25 : 0} />
    </mesh>
  )
}

function Scene({ board, pending, last, onSquare, lowPower }: Scrabble3DProps) {
  const cells = useMemo(() => Array.from({ length: SIZE * SIZE }, (_, i) => i), [])
  return (
    <>
      <color attach="background" args={["#0b1f1a"]} />
      <hemisphereLight args={["#fff4d6", "#0b1f1a", 0.85]} />
      <directionalLight position={[6, 14, 8]} intensity={1.6} castShadow={!lowPower} shadow-mapSize={[1024, 1024]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} />
      <pointLight position={[-7, 6, -5]} intensity={18} color="#ffd27a" distance={26} />
      <RoundedBox args={[16.2, 0.5, 16.2]} radius={0.2} smoothness={4} position={[0, -0.36, 0]} receiveShadow>
        <meshStandardMaterial color="#3a2414" roughness={0.45} metalness={0.15} />
      </RoundedBox>
      <mesh position={[0, -0.095, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <ringGeometry args={[10.72, 10.95, 4, 1]} />
        <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.25} />
      </mesh>
      {cells.map((i) => (
        <Square key={i} i={i} onSquare={onSquare} isLast={last.includes(i)} />
      ))}
      {board.map((c, i) => (c ? <Tile key={`b${i}`} i={i} l={c.l} blank={c.blank} fresh={false} onSquare={onSquare} /> : null))}
      {pending.map((t) => (
        <Tile key={`p${t.i}`} i={t.i} l={t.l} blank={Boolean(t.blank)} fresh onSquare={onSquare} />
      ))}
    </>
  )
}

/** Plateau de Scrabble 3D (Three.js). Même logique que le plateau 2D : seul l'affichage change. */
export function ScrabbleBoard3D(props: Scrabble3DProps) {
  return (
    <Canvas
      className="gboard3d-canvas"
      shadows={!props.lowPower}
      dpr={[1, 1.5]}
      camera={{ position: [0, 23.5, 12], fov: 42, near: 0.1, far: 80 }}
      gl={{ antialias: !props.lowPower, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: props.lowPower ? "low-power" : "high-performance" }}
      onCreated={({ camera }) => camera.lookAt(0, -1.2, 0.9)}
    >
      <Scene {...props} />
    </Canvas>
  )
}
