/**
 * The fields Veritas is built for, as two rows of badges gliding in opposite
 * directions. Fields, not company logos: naming organisations that aren't
 * customers would be a claim the page can't back.
 *
 * Icons are Lucide outlines (ISC), inlined as path data.
 */
type Field = { name: string; icon: string[] }

const ROWS: Field[][] = [
  [
    { name: 'Healthcare & Clinical Research', icon: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z', 'M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27'] },
    { name: 'Law & Compliance', icon: ['m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z', 'm2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z', 'M7 21h10', 'M12 3v18', 'M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2'] },
    { name: 'Finance & Investment', icon: ['M22 7l-8.5 8.5-5-5L2 17', 'M16 7h6v6'] },
    { name: 'Public Policy & Government', icon: ['M3 22h18', 'M6 18v-7', 'M10 18v-7', 'M14 18v-7', 'M18 18v-7', 'M12 2l8 5H4z'] },
    { name: 'Pharmaceutical R&D', icon: ['M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2', 'M8.5 2h7', 'M7 16h10'] },
  ],
  [
    { name: 'Academia & Research', icon: ['M22 10v6M2 10l10-5 10 5-10 5z', 'M6 12v5c3 3 9 3 12 0v-5'] },
    { name: 'Engineering', icon: ['M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M9 9h6v6H9z', 'M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2'] },
    { name: 'Journalism & Fact-Checking', icon: ['M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2', 'M18 14h-8', 'M15 18h-5', 'M10 6h8v4h-8V6Z'] },
    { name: 'Cybersecurity', icon: ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z', 'm9 12 2 2 4-4'] },
    { name: 'Energy & Climate', icon: ['M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z'] },
  ],
]

function Badge({ field }: { field: Field }) {
  return (
    <span className="group flex shrink-0 items-center gap-2.5 rounded-full border-2 border-white bg-black py-1.5 pl-1.5 pr-4 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:border-brand hover:bg-brand hover:text-black hover:shadow-[0_6px_20px_-4px_var(--color-brand)]">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-black transition-colors duration-300 group-hover:bg-black group-hover:text-brand">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {field.icon.map((d) => <path key={d} d={d} />)}
        </svg>
      </span>
      {field.name}
    </span>
  )
}

export default function TrustedFields() {
  return (
    // A brand glow rising from the top edge lifts the black panel off the page.
    <section className="marquee flex w-full flex-col gap-3 overflow-hidden rounded-2xl border-2 border-brand bg-black bg-[radial-gradient(ellipse_at_top,_rgb(53_182_158_/_0.28),_transparent_65%)] py-6 text-center shadow-lg">
      <h3 className="mb-2 px-4 text-xs font-extrabold uppercase tracking-widest text-white sm:text-sm">
        Built for professionals in <span className="text-brand">critical fields</span>
      </h3>

      {ROWS.map((row, r) => (
        // The track holds the row twice and slides by exactly one copy, so
        // the loop has no seam. Each copy carries its own trailing gap.
        <div key={r} className={`marquee-track flex w-max ${r % 2 ? 'marquee-reverse' : ''}`}>
          {[0, 1].map((copy) => (
            <div key={copy} className="flex gap-3 pr-3" aria-hidden={copy === 1}>
              {row.map((field) => <Badge key={field.name} field={field} />)}
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}
