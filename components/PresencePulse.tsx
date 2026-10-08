"use client"

import { useEffect } from "react"

const BEAT_MS = 25_000

export function PresencePulse() {
  useEffect(() => {
    let stop = false
    const beat = () => {
      if (stop || document.visibilityState === "hidden") return
      void fetch("/api/presence", { method: "POST" })
    }
    beat()
    const id = window.setInterval(beat, BEAT_MS)
    document.addEventListener("visibilitychange", beat)
    return () => {
      stop = true
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", beat)
    }
  }, [])
  return null
}
