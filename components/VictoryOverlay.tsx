"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

const SEEN_PREFIX = "ba-victoire:"
const memorySeen = new Set<string>()

/** Couleurs du confetti : or, vert, rouge, bleu, plus un ocre et un crème (wax/kente). */
const CONFETTI = ["#e4c36a", "#f5d77b", "#1f9d55", "#d64545", "#2f6fd6", "#c9772b", "#f6f1e6"]

function alreadySeen(id: string, persist: boolean) {
  if (memorySeen.has(id)) return true
  if (!persist) return false
  try {
    return window.sessionStorage.getItem(SEEN_PREFIX + id) === "1"
  } catch {
    return false
  }
}

function markSeen(id: string, persist: boolean) {
  memorySeen.add(id)
  if (!persist) return
  try {
    window.sessionStorage.setItem(SEEN_PREFIX + id, "1")
  } catch {
    /* navigation privée : la mémoire du composant suffit */
  }
}

type Particle = { x: number; y: number; vx: number; vy: number; r: number; w: number; h: number; spin: number; color: string; shape: number }

function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener("resize", resize)
    const count = width < 500 ? 110 : 190
    const particles: Particle[] = Array.from({ length: count }, (_, i) => {
      const fromLeft = i % 2 === 0
      const burst = i < count * 0.45
      const angle = burst ? Math.random() * Math.PI * 2 : (fromLeft ? -Math.PI / 3 : (-2 * Math.PI) / 3) + (Math.random() - 0.5) * 0.6
      const speed = burst ? 4 + Math.random() * 9 : 9 + Math.random() * 8
      return {
        x: burst ? width / 2 : fromLeft ? 0 : width,
        y: burst ? height * 0.42 : height * 0.9,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (burst ? 2 : 0),
        r: Math.random() * Math.PI,
        w: 6 + Math.random() * 7,
        h: 9 + Math.random() * 9,
        spin: (Math.random() - 0.5) * 0.3,
        color: CONFETTI[i % CONFETTI.length],
        shape: i % 3,
      }
    })
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = now - start
      ctx.clearRect(0, 0, width, height)
      const fade = t > 3800 ? Math.max(0, 1 - (t - 3800) / 1200) : 1
      for (const p of particles) {
        p.vy += 0.16
        p.vx *= 0.992
        p.vy *= 0.992
        p.x += p.vx + Math.sin((t + p.r * 900) / 260) * 0.6
        p.y += p.vy
        p.r += p.spin
        ctx.save()
        ctx.globalAlpha = fade
        ctx.translate(p.x, p.y)
        ctx.rotate(p.r)
        ctx.fillStyle = p.color
        if (p.shape === 0) ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(t / 180 + p.r)))
        else if (p.shape === 1) {
          ctx.beginPath()
          ctx.arc(0, 0, p.w / 2.4, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.moveTo(0, -p.h / 2)
          ctx.lineTo(p.w / 2, p.h / 2)
          ctx.lineTo(-p.w / 2, p.h / 2)
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
      }
      if (t < 5000) frame = requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, width, height)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", resize)
    }
  }, [])
  return <canvas ref={ref} className="vo-confetti" aria-hidden="true" />
}

function Crown() {
  return (
    <svg className="vo-crown" viewBox="0 0 120 90" aria-hidden="true">
      <defs>
        <linearGradient id="vo-crown-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1b8" />
          <stop offset="0.45" stopColor="#e4c36a" />
          <stop offset="1" stopColor="#a8761f" />
        </linearGradient>
      </defs>
      <path d="M10 72 L4 22 L34 44 L60 8 L86 44 L116 22 L110 72 Z" fill="url(#vo-crown-gold)" stroke="#7a5414" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="10" y="70" width="100" height="14" rx="4" fill="url(#vo-crown-gold)" stroke="#7a5414" strokeWidth="2.5" />
      <circle cx="60" cy="8" r="6" fill="#d64545" stroke="#7a5414" strokeWidth="2" />
      <circle cx="4" cy="22" r="5" fill="#1f9d55" stroke="#7a5414" strokeWidth="2" />
      <circle cx="116" cy="22" r="5" fill="#2f6fd6" stroke="#7a5414" strokeWidth="2" />
      <circle cx="36" cy="77" r="3.5" fill="#d64545" />
      <circle cx="60" cy="77" r="3.5" fill="#1f9d55" />
      <circle cx="84" cy="77" r="3.5" fill="#2f6fd6" />
    </svg>
  )
}

/**
 * Grand message « Victoire pour … » au-dessus du plateau.
 * S'affiche une seule fois par partie : `id` (code de partie + manche) est mémorisé
 * en sessionStorage, donc les rafraîchissements du polling ne le relancent pas.
 */
export function VictoryOverlay({
  id,
  winnerName,
  isYou = false,
  amount,
  persist = true,
}: {
  /** null tant que la partie n'est pas gagnée. */
  id: string | null
  winnerName: string
  isYou?: boolean
  amount?: string | null
  persist?: boolean
}) {
  const [shown, setShown] = useState<string | null>(null)
  const [reduced, setReduced] = useState(false)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!id || alreadySeen(id, persist)) return
    markSeen(id, persist)
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    setShown(id)
  }, [id, persist])

  const close = useCallback(() => setShown(null), [])

  useEffect(() => {
    if (!shown) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    const focus = window.setTimeout(() => button.current?.focus({ preventScroll: true }), 60)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.clearTimeout(focus)
    }
  }, [shown, close])

  if (!shown || typeof document === "undefined") return null

  const word = "Victoire"
  const subject = `pour ${winnerName}`

  return createPortal(
    <div
      className={reduced ? "vo-root vo-reduced" : "vo-root"}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vo-title"
      aria-describedby="vo-sub"
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div className="vo-burst" aria-hidden="true">
        <span className="vo-rays" />
        <span className="vo-rays vo-rays-2" />
        <span className="vo-glow" />
      </div>
      {reduced ? null : <Confetti />}
      <div className="vo-card" aria-live="assertive">
        <Crown />
        <h2 id="vo-title" className="vo-title">
          <span className="sr-only">
            {word} {subject}
          </span>
          <span className="vo-word" aria-hidden="true">
            {word.split("").map((letter, index) => (
              <span key={index} className="vo-letter" style={{ ["--i" as string]: index }}>
                {letter}
              </span>
            ))}
            <span className="vo-shine">{word}</span>
          </span>
          <span className="vo-subject" aria-hidden="true">
            {subject.split("").map((letter, index) => (
              <span key={index} className="vo-char" style={{ ["--i" as string]: index }}>
                {letter === " " ? "\u00a0" : letter}
              </span>
            ))}
          </span>
        </h2>
        <p id="vo-sub" className="vo-sub">
          {isYou ? "Bravo ! Tu remportes la partie." : "La partie est terminée."}
        </p>
        {amount ? <p className="vo-amount">{amount}</p> : null}
        <button ref={button} type="button" className="vo-button" onClick={close}>
          Continuer
        </button>
      </div>
    </div>,
    document.body,
  )
}
