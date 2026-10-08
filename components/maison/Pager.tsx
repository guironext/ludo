import Link from "next/link"
import { withParams } from "@/lib/maison"

export function Pager({ base, params, page, total, size }: { base: string; params: Record<string, string | undefined>; page: number; total: number; size: number }) {
  const pages = Math.max(1, Math.ceil(total / size))
  if (pages <= 1) return <p className="maison-count">{total} résultat{total > 1 ? "s" : ""}</p>
  return (
    <nav className="maison-pager" aria-label="Pagination">
      {page > 1 ? <Link href={withParams(base, params, { page: String(page - 1) })}>← Précédent</Link> : <span className="off">← Précédent</span>}
      <span>Page {page} / {pages} · {total} résultats</span>
      {page < pages ? <Link href={withParams(base, params, { page: String(page + 1) })}>Suivant →</Link> : <span className="off">Suivant →</span>}
    </nav>
  )
}

export function Filters({ base, params, groups }: { base: string; params: Record<string, string | undefined>; groups: { key: string; label: string; options: readonly { id: string; label: string }[] }[] }) {
  return (
    <div className="maison-filters">
      {groups.map((g) => (
        <div key={g.key} className="maison-filter">
          <span>{g.label}</span>
          <div>
            {[{ id: "tout", label: "Tous" }, ...g.options.filter((o) => o.id !== "tout")].map((o) => {
              const active = (params[g.key] ?? "tout") === o.id
              return (
                <Link key={o.id} href={withParams(base, params, { [g.key]: o.id, page: undefined })} className={active ? "active" : undefined}>
                  {o.id === "tout" && g.key === "periode" ? "Tout" : o.label}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
