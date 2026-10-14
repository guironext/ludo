"use client"

import { useMemo, useRef, useState } from "react"
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber"
import { RoundedBox } from "@react-three/drei"
import * as THREE from "three"
import type { ChessState, PieceType } from "@/lib/games/chess"

/** Palette 3D : cases jade / ivoire, pièces ivoire et ébène, accents or. */
const DARK_SQ = "#1f6b55"
const LIGHT_SQ = "#fff4d8"
const FRAME = "#2a1a10"
const GOLD = "#f2c75c"
const IVORY = "#fbf3df"
const EBONY = "#1b1512"

export type Chess3DProps = {
  s: ChessState
  flip: boolean
  sel: number | null
  targets: number[]
  movable: number[]
  last: number[]
  checkSq: number
  onSquare: (i: number) => void
  lowPower: boolean
}

function pos(i: number): [number, number] {
  return [(i % 8) - 3.5, Math.floor(i / 8) - 3.5]
}

const v = (x: number, y: number) => new THREE.Vector2(x, y)
/** Profils de révolution (rayon, hauteur) pour chaque pièce. */
const PROFILES: Record<Exclude<PieceType, "n">, THREE.Vector2[]> = {
  p: [v(0, 0), v(0.3, 0), v(0.3, 0.06), v(0.22, 0.12), v(0.12, 0.3), v(0.1, 0.42), v(0.18, 0.46), v(0.1, 0.5), v(0.16, 0.6), v(0.14, 0.72), v(0, 0.76)],
  r: [v(0, 0), v(0.33, 0), v(0.33, 0.07), v(0.24, 0.14), v(0.19, 0.5), v(0.27, 0.6), v(0.27, 0.8), v(0.2, 0.8), v(0.2, 0.72), v(0, 0.72)],
  b: [v(0, 0), v(0.32, 0), v(0.32, 0.07), v(0.22, 0.14), v(0.12, 0.5), v(0.2, 0.55), v(0.12, 0.6), v(0.17, 0.75), v(0.12, 0.92), v(0.05, 0.98), v(0.07, 1.02), v(0, 1.06)],
  q: [v(0, 0), v(0.35, 0), v(0.35, 0.07), v(0.25, 0.15), v(0.13, 0.62), v(0.23, 0.68), v(0.15, 0.74), v(0.24, 1.0), v(0.18, 1.04), v(0.08, 1.1), v(0.09, 1.16), v(0, 1.2)],
  k: [v(0, 0), v(0.36, 0), v(0.36, 0.07), v(0.26, 0.15), v(0.14, 0.66), v(0.24, 0.72), v(0.16, 0.78), v(0.23, 1.04), v(0.12, 1.1), v(0, 1.12)],
}
const KNIGHT_BASE = [v(0, 0), v(0.33, 0), v(0.33, 0.07), v(0.24, 0.14), v(0.2, 0.3), v(0, 0.32)]

function PieceBody({ t, mat, accent, onClick }: { t: PieceType; mat: React.ReactNode; accent: React.ReactNode; onClick: (e: ThreeEvent<MouseEvent>) => void }) {
  const geo = useMemo(() => new THREE.LatheGeometry(t === "n" ? KNIGHT_BASE : PROFILES[t], 32), [t])
  return (
    <group onClick={onClick}>
      <mesh geometry={geo} castShadow>{mat}</mesh>
      <mesh position={[0, 0.075, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.02, 10, 40]} />
        {accent}
      </mesh>
      {t === "n" ? (
        <>
          <mesh position={[0, 0.5, 0.02]} rotation={[0.25, 0, 0]} castShadow>
            <boxGeometry args={[0.24, 0.42, 0.3]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.66, -0.14]} rotation={[0.9, 0, 0]} castShadow>
            <boxGeometry args={[0.22, 0.2, 0.36]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.66, 0.14]} rotation={[-0.3, 0, 0]}>
            <boxGeometry args={[0.06, 0.32, 0.08]} />
            {accent}
          </mesh>
        </>
      ) : null}
      {t === "r" ? (
        <mesh position={[0, 0.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.235, 0.025, 8, 32]} />
          {accent}
        </mesh>
      ) : null}
      {t === "q" ? (
        <mesh position={[0, 1.04, 0]}>
          <cylinderGeometry args={[0.2, 0.17, 0.06, 10]} />
          {accent}
        </mesh>
      ) : null}
      {t === "b" ? (
        <mesh position={[0, 1.03, 0]}>
          <sphereGeometry args={[0.05, 16, 12]} />
          {accent}
        </mesh>
      ) : null}
      {t === "k" ? (
        <>
          <mesh position={[0, 1.24, 0]}>
            <boxGeometry args={[0.06, 0.26, 0.06]} />
            {accent}
          </mesh>
          <mesh position={[0, 1.26, 0]}>
            <boxGeometry args={[0.2, 0.06, 0.06]} />
            {accent}
          </mesh>
        </>
      ) : null}
    </group>
  )
}

function Piece({ i, t, white, selected, canMove, check, onSquare }: { i: number; t: PieceType; white: boolean; selected: boolean; canMove: boolean; check: boolean; onSquare: (i: number) => void }) {
  const ref = useRef<THREE.Group>(null)
  const [x, z] = pos(i)
  useFrame((state) => {
    const g = ref.current
    if (!g) return
    const lift = selected ? 0.25 + Math.sin(state.clock.elapsedTime * 4) * 0.04 : canMove ? 0.03 + Math.sin(state.clock.elapsedTime * 3 + i) * 0.02 : 0
    g.position.y += (lift - g.position.y) * 0.2
  })
  const glow = selected ? GOLD : check ? "#ff3d4f" : "#000000"
  const mat = (
    <meshPhysicalMaterial color={white ? IVORY : EBONY} roughness={white ? 0.25 : 0.18} metalness={0.05} clearcoat={1} clearcoatRoughness={0.1} emissive={glow} emissiveIntensity={selected ? 0.25 : check ? 0.45 : 0} />
  )
  const accent = <meshStandardMaterial color={GOLD} metalness={0.85} roughness={0.25} emissive={GOLD} emissiveIntensity={white ? 0.1 : 0.3} />
  return (
    <group position={[x, 0, z]} rotation={[0, white ? 0 : Math.PI, 0]}>
      <group ref={ref}>
        <PieceBody
          t={t}
          mat={mat}
          accent={accent}
          onClick={(e) => {
            e.stopPropagation()
            onSquare(i)
          }}
        />
      </group>
    </group>
  )
}

type SqState = "sel" | "target" | "capture" | "check" | "last" | "movable" | null

function Square({ i, dark, onSquare, state }: { i: number; dark: boolean; onSquare: (i: number) => void; state: SqState }) {
  const [x, z] = pos(i)
  const [hover, setHover] = useState(false)
  const base = dark ? DARK_SQ : LIGHT_SQ
  const tint = state === "check" ? "#c9303f" : state === "sel" ? "#3f9b78" : state === "last" ? (dark ? "#5f8f45" : "#e9e59a") : hover ? (dark ? "#2a8268" : "#fffbe9") : base
  return (
    <group position={[x, 0, z]}>
      <mesh
        position={[0, -0.05, 0]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation()
          onSquare(i)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
      >
        <boxGeometry args={[1, 0.1, 1]} />
        <meshStandardMaterial color={tint} roughness={0.55} metalness={0.05} emissive={dark || state ? "#000000" : "#fff1cf"} emissiveIntensity={dark || state ? 0 : 0.28} />
      </mesh>
      {state === "target" ? (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.15, 32]} />
          <meshBasicMaterial color={GOLD} toneMapped={false} />
        </mesh>
      ) : null}
      {state === "capture" || state === "movable" || state === "sel" ? (
        <mesh position={[0, 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={state === "capture" ? [0.38, 0.48, 40] : [0.43, 0.48, 40]} />
          <meshBasicMaterial color={state === "capture" ? "#ff6b4a" : state === "sel" ? "#fff3c4" : GOLD} transparent opacity={state === "movable" ? 0.55 : 1} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  )
}

function Scene({ s, flip, sel, targets, movable, last, checkSq, onSquare, lowPower }: Chess3DProps) {
  const squares = useMemo(() => Array.from({ length: 64 }, (_, i) => i), [])
  return (
    <>
      <color attach="background" args={["#0b1f1a"]} />
      <hemisphereLight args={["#fff4d6", "#0b1f1a", 0.8]} />
      <directionalLight position={[5, 11, 6]} intensity={1.7} castShadow={!lowPower} shadow-mapSize={[1024, 1024]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} />
      <pointLight position={[-5, 5, -4]} intensity={16} color="#ffd27a" distance={20} />
      <group rotation={[0, flip ? Math.PI : 0, 0]}>
        <RoundedBox args={[9, 0.5, 9]} radius={0.18} smoothness={4} position={[0, -0.36, 0]} receiveShadow>
          <meshStandardMaterial color={FRAME} roughness={0.45} metalness={0.15} />
        </RoundedBox>
        <mesh position={[0, -0.095, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
          <ringGeometry args={[5.78, 5.98, 4, 1]} />
          <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.25} />
        </mesh>
        {squares.map((i) => {
          const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1
          const state: SqState =
            checkSq === i ? "check" : sel === i ? "sel" : targets.includes(i) ? (s.board[i] ? "capture" : "target") : movable.includes(i) ? "movable" : last.includes(i) ? "last" : null
          return <Square key={i} i={i} dark={dark} onSquare={onSquare} state={state} />
        })}
        {s.board.map((p, i) =>
          p ? <Piece key={`${i}-${p.c}-${p.t}`} i={i} t={p.t} white={p.c === "w"} selected={sel === i} canMove={movable.includes(i)} check={checkSq === i} onSquare={onSquare} /> : null,
        )}
      </group>
    </>
  )
}

/** Échiquier 3D (Three.js). Même logique de coups que l'échiquier 2D : seul l'affichage change. */
export function ChessBoard3D(props: Chess3DProps) {
  return (
    <Canvas
      className="gboard3d-canvas"
      shadows={!props.lowPower}
      dpr={[1, 1.5]}
      camera={{ position: [0, 11.6, 8.2], fov: 42, near: 0.1, far: 60 }}
      gl={{ antialias: !props.lowPower, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: props.lowPower ? "low-power" : "high-performance" }}
      onCreated={({ camera }) => camera.lookAt(0, -0.4, 0.4)}
    >
      <Scene {...props} />
    </Canvas>
  )
}
