import Link from "next/link"

export type SalonChoice = {
  players: 1 | 2 | 3 | 4
  eyebrow: string
  title: string
  detail: string
  tone: "ai" | "duo" | "trio" | "full"
  seats: Array<"green" | "yellow" | "blue" | "red" | "ai">
  stake?: string
}

export function SalonCard({ salon, href }: { salon: SalonChoice; href: string }) {
  return (
    <Link href={href} className="salon-card" data-tone={salon.tone} prefetch={false}>
      <span className="salon-board" data-count={salon.seats.length} aria-hidden="true">
        {salon.seats.map((seat, index) =>
          seat === "ai" ? (
            <span key={index} className="salon-pawn is-ai">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
          ) : (
            <span key={index} className={`salon-pawn camp ${seat}`} />
          ),
        )}
      </span>
      <span className="salon-copy">
        <span className="kicker">{salon.eyebrow}</span>
        <strong>{salon.title}</strong>
        <span>{salon.detail}</span>
      </span>
      <span className="salon-foot">
        <span>{salon.stake ?? "50 poky"}</span>
        <span>Entrer</span>
      </span>
    </Link>
  )
}
