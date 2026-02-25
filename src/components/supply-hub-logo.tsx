interface SupplyHubLogoProps {
  size?: number
  className?: string
}

export function SupplyHubLogo({ size = 32, className }: SupplyHubLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
    >
      <rect width="32" height="32" rx="7" fill="#2563eb" />
      <path
        d="M21 8H16C11.5 8 11.5 16 16 16C20.5 16 20.5 24 16 24H11"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M18 5.5L21 8 18 10.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
