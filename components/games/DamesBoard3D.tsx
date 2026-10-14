"use client"

import { useMemo, useRef, useState } from "react"
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber"
import { RoundedBox } from "@react-three/drei"
import * as THREE from "three"
import type { DamesState } from "@/lib/games/dames"

/** Palette 3D : damier vert profond / sable, pions ivoire nacré et rubis, accents or. */
const DARK_SQ = "#13493c"
const LIGHT_SQ = "#efe0bb"
const FRAME = "#3a2414"
const GOLD = "#f2c75c"
const IVORY = "#fbf3df"
const RUBY = "#b3202b"

export type Dames3DProps = {
  s: DamesState
  flip: boolean
  sel: number | null
  targets: number[]
  movable: number[]
  last: number[]
  onSquare: (i: number) => void
  lowPower: boolean
}

function pos(i: number): [number, number] {
  const row = Math.floor(i / 10)
  const col = i % 10
  return [col - 4.5, row - 4.5]
}

function Piece({ i, white, king, selected, canMove, onSquare }: { i: number; white: boolean; king: boolean; selected: boolean; canMove: boolean; onSquare: (i: number) => void }) {
  const ref = useRef<THREE.Group>(null)
  const [x, z] = pos(i)
  useFrame((state) => {
    const g = ref.current
    if (!g) return
    const lift = selected ? 0.28 + Math.sin(state.clock.elapsedTime * 4) * 0.04 : canMove ? 0.04 + Math.sin(state.clock.elapsedTime * 3 + i) * 0.03 : 0
    g.position.y += (lift - g.position.y) * 0.2
  })
  const color = white ? IVORY : RUBY
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSquare(i)
  }
  return (
    <group position={[x, 0, z]}>
      <group ref={ref}>
        <mesh position={[0, 0.17, 0]} castShadow onClick={click}>
          <cylinderGeometry args={[0.4, 0.42, 0.2, 40]} />
          <meshPhysicalMaterial color={color} roughness={0.22} metalness={0.05} clearcoat={1} clearcoatRoughness={0.12} emissive={selected ? GOLD : "#000000"} emissiveIntensity={selected ? 0.25 : 0} />
        </mesh>
        <mesh position={[0, 0.275, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.27, 0.025, 12, 40]} />
          <meshStandardMaterial color={white ? "#c9a24a" : GOLD} metalness={0.8} roughness={0.25} />
        </mesh>
        {king ? (
          <>
            <mesh position={[0, 0.38, 0]} castShadow onClick={click}>
              <cylinderGeometry args={[0.36, 0.4, 0.18, 40]} />
              <meshPhysicalMaterial color={color} roughness={0.22} clearcoat={1} clearcoatRoughness={0.12} />
            </mesh>
            <mesh position={[0, 0.53, 0]}>
              <cylinderGeometry args={[0.14, 0.2, 0.14, 6]} />
              <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.2} emissive={GOLD} emissiveIntensity={0.35} />
            </mesh>
          </>
        ) : null}
      </group>
    </group>
  )
}

function Square({ i, dark, onSquare, state }: { i: number; dark: boolean; onSquare: (i: number) => void; state: "sel" | "target" | "last" | "movable" | null }) {
  const [x, z] = pos(i)
  const [hover, setHover] = useState(false)
  const base = dark ? DARK_SQ : LIGHT_SQ
  const tint = state === "sel" ? "#2c7a63" : state === "last" ? "#3a6b4d" : hover && dark ? "#1b5e4d" : base
  return (
    <group position={[x, 0, z]}>
      <mesh
        position={[0, -0.05, 0]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation()
          if (dark) onSquare(i)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          if (dark) setHover(true)
        }}
        onPointerOut={() => setHover(false)}
      >
        <boxGeometry args={[1, 0.1, 1]} />
        <meshStandardMaterial color={tint} roughness={dark ? 0.55 : 0.7} metalness={0.05} />
      </mesh>
      {state === "target" ? (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.17, 32]} />
          <meshBasicMaterial color={GOLD} transparent opacity={0.95} toneMapped={false} />
        </mesh>
      ) : null}
      {state === "movable" || state === "sel" ? (
        <mesh position={[0, 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.44, 0.49, 40]} />
          <meshBasicMaterial color={state === "sel" ? "#fff3c4" : GOLD} transparent opacity={state === "sel" ? 1 : 0.6} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  )
}

function Scene({ s, flip, sel, targets, movable, last, onSquare, lowPower }: Dames3DProps) {
  const squares = useMemo(() => Array.from({ length: 100 }, (_, i) => i), [])
  return (
    <>
      <color attach="background" args={["#0b1f1a"]} />
      <hemisphereLight args={["#fff4d6", "#0b1f1a", 0.75]} />
      <directionalLight position={[6, 12, 6]} intensity={1.6} castShadow={!lowPower} shadow-mapSize={[1024, 1024]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} />
      <pointLight position={[-6, 5, -4]} intensity={18} color="#ffd27a" distance={22} />
      <group rotation={[0, flip ? Math.PI : 0, 0]}>
        <RoundedBox args={[11, 0.5, 11]} radius={0.18} smoothness={4} position={[0, -0.36, 0]} receiveShadow>
          <meshStandardMaterial color={FRAME} roughness={0.45} metalness={0.15} />
        </RoundedBox>
        <mesh position={[0, -0.095, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
          <ringGeometry args={[7.12, 7.32, 4, 1]} />
          <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.25} />
        </mesh>
        {squares.map((i) => {
          const dark = (Math.floor(i / 10) + (i % 10)) % 2 === 1
          const state = sel === i ? "sel" : targets.includes(i) ? "target" : movable.includes(i) ? "movable" : last.includes(i) ? "last" : null
          return <Square key={i} i={i} dark={dark} onSquare={onSquare} state={state} />
        })}
        {s.board.map((p, i) =>
          p ? <Piece key={`${i}-${p.c}-${p.king}`} i={i} white={p.c === "w"} king={Boolean(p.king)} selected={sel === i} canMove={movable.includes(i)} onSquare={onSquare} /> : null,
        )}
      </group>
    </>
  )
}

/** Damier 3D (Three.js). Même logique de coups que le damier 2D : seul l'affichage change. */
export function DamesBoard3D(props: Dames3DProps) {
  return (
    <Canvas
      className="gboard3d-canvas"
      shadows={!props.lowPower}
      dpr={[1, 1.5]}
      camera={{ position: [0, 14.2, 9.6], fov: 42, near: 0.1, far: 60 }}
      gl={{ antialias: !props.lowPower, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: props.lowPower ? "low-power" : "high-performance" }}
      onCreated={({ camera }) => camera.lookAt(0, -0.8, 0.4)}
    >
      <Scene {...props} />
    </Canvas>
  )
}
