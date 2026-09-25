export function PdfIcon({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="4" width="26" height="34" rx="4" fill="#ffffff" stroke="#fca5a5" strokeWidth="1.5" />
      <path d="M30 4 L36 10 L30 10 Z" fill="#fecaca" />
      <rect x="4" y="10" width="26" height="34" rx="4" fill="#dc2626" />
      <path d="M24 10 L30 16 L24 16 Z" fill="#f87171" />
      <rect x="0" y="30" width="24" height="13" rx="3" fill="#991b1b" />
      <text x="12" y="39.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="white" fontFamily="Helvetica, Arial, sans-serif">
        PDF
      </text>
    </svg>
  )
}

export function WordIcon({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="4" width="26" height="34" rx="4" fill="#ffffff" stroke="#93c5fd" strokeWidth="1.5" />
      <path d="M34 4 L40 10 L34 10 Z" fill="#bfdbfe" />
      <rect x="20" y="16" width="14" height="2" rx="1" fill="#93c5fd" />
      <rect x="20" y="21" width="14" height="2" rx="1" fill="#93c5fd" />
      <rect x="20" y="26" width="9" height="2" rx="1" fill="#93c5fd" />
      <rect x="2" y="12" width="24" height="24" rx="5" fill="#2563eb" />
      <text x="14" y="29" textAnchor="middle" fontSize="16" fontWeight="800" fill="white" fontFamily="Georgia, 'Times New Roman', serif">
        W
      </text>
    </svg>
  )
}
