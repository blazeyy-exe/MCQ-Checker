import type { SVGProps } from "react";

type MarkVariant = "full-color" | "white-on-indigo" | "mono-navy" | "reversed";

interface Props extends Omit<SVGProps<SVGSVGElement>, "viewBox"> {
  variant?: MarkVariant;
}

export function TickdMark({ variant = "full-color", ...props }: Props) {
  if (variant === "mono-navy") {
    return (
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
        <rect x="3" y="3" width="58" height="58" rx="18" stroke="#0F1535" strokeWidth="4.5" />
        <path d="M12 27V17h10M52 37v10H42M12 37v10h10" stroke="#0F1535" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 33l8 8 21-25" stroke="#0F1535" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (variant === "reversed") {
    return (
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
        <rect width="64" height="64" rx="18" fill="#0F1535" />
        <path d="M12 27V17h10M52 37v10H42M12 37v10h10" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 33l8 8 21-25" stroke="#FFC531" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <rect width="64" height="64" rx="18" fill="#4B3BFF" />
      <path d="M12 27V17h10M52 37v10H42M12 37v10h10" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 33l8 8 21-25" stroke="#FFC531" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
