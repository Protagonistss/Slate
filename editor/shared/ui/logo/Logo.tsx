import { Link } from "react-router";
import { cn } from "@/lib/utils";

export interface LogoProps {
  className?: string;
  to?: string;
}

export function Logo({ className, to = "/" }: LogoProps) {
  const logoElement = (
    <div className={cn("flex items-center justify-center group", className)}>
      <div className="relative w-7 h-7 rounded-lg bg-gradient-to-b from-zinc-700 to-zinc-800/80 flex items-center justify-center border border-zinc-600/50 shadow-sm group-hover:border-zinc-500 transition-all duration-300 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
        <div className="flex gap-[2px] rotate-[15deg] group-hover:rotate-[0deg] transition-transform duration-500 ease-out">
          <div className="w-[3px] h-[10px] bg-zinc-100 rounded-[1px]" />
          <div className="w-[3px] h-[10px] bg-zinc-500 rounded-[1px] translate-y-[3px] group-hover:translate-y-0 transition-transform duration-500 ease-out" />
        </div>
      </div>
    </div>
  );

  if (to) {
    return <Link to={to}>{logoElement}</Link>;
  }

  return logoElement;
}

export interface SimpleLogoProps {
  size?: number;
  className?: string;
}

export function SimpleLogo({ size = 32, className }: SimpleLogoProps) {
  return (
    <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-zinc-700 to-zinc-800/80 border border-zinc-600/50" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/10 rounded-t-xl" />
      <div className="flex gap-[10%] rotate-[15deg] w-[40%] h-[60%]">
        <div className="w-[30%] h-full bg-zinc-100 rounded-sm" />
        <div className="w-[30%] h-full bg-zinc-500 rounded-sm translate-y-[20%]" />
      </div>
    </div>
  );
}

export const LogoSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="logoGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#525252;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#404040;stop-opacity:0.8" />
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="6" fill="url(#logoGradient)" stroke="#525252" stroke-width="0.5"/>
  <rect x="0" y="0" width="32" height="1" fill="white" fill-opacity="0.1"/>
  <g transform="rotate(15, 16, 16)">
    <rect x="11" y="8" width="3" height="12" rx="0.5" fill="#f4f4f5"/>
    <rect x="15" y="10" width="3" height="12" rx="0.5" fill="#71717a"/>
  </g>
</svg>
`;
