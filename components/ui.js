"use client";

// Small shared building blocks used across every page.
// Keeping these in one file makes it easy to tweak the whole
// look of the app (colors, spacing) from one place.

export const SKILL_OPTIONS = [
  "SketchUp", "AutoCAD", "Rhino", "Revit", "D5 Render",
  "Lumion", "V-Ray", "Photoshop", "Illustrator", "InDesign",
  "QGIS", "Model Making",
];

export const CATEGORIES = [
  "All", "3D Rendering", "CAD Drafting", "3D Modeling", "Photoshop",
  "Visualization", "Presentation", "Model Making", "Site Analysis",
  "Research", "Other",
];

export const money = (n) => "৳" + Number(n || 0).toLocaleString("en-US");

export function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AG";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function makeAgentCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return "AG-" + s;
}

export function Avatar({ tag, size = 36 }) {
  const hue = (tag.charCodeAt(0) * 37 + (tag.charCodeAt(1) || 0) * 17) % 360;
  return (
    <div
      style={{ width: size, height: size, background: `hsl(${hue} 45% 93%)`, color: `hsl(${hue} 40% 32%)` }}
      className="rounded-full flex items-center justify-center font-display font-bold shrink-0"
    >
      <span style={{ fontSize: size * 0.36 }}>{tag}</span>
    </div>
  );
}

export function Pill({ children, tone = "default", className = "" }) {
  const tones = {
    default: "bg-paperdim text-inksoft border-line",
    accent: "bg-accentsoft text-accentink border-accent/30",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded-[3px] border ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function PrimaryButton({ children, onClick, className = "", type = "button", disabled }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 bg-ink text-paper hover:bg-accent font-medium text-[14px] px-5 py-2.5 rounded-[4px] transition-colors disabled:opacity-40 disabled:pointer-events-none ${className}`}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, className = "", disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 bg-transparent text-ink border border-line hover:border-accent hover:text-accent font-medium text-[14px] px-5 py-2.5 rounded-[4px] transition-colors disabled:opacity-40 disabled:pointer-events-none ${className}`}>
      {children}
    </button>
  );
}

export function Icon({ children, size = 18, strokeWidth = 1.6, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}
export const IconSearch = (p) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Icon>;
export const IconArrowLeft = (p) => <Icon {...p}><path d="M19 12H5" /><path d="M11 18l-6-6 6-6" /></Icon>;
export const IconArrowRight = (p) => <Icon {...p}><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></Icon>;
export const IconPlus = (p) => <Icon {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Icon>;
export const IconCheck = (p) => <Icon {...p}><path d="M20 6 9 17l-5-5" /></Icon>;
export const IconBriefcase = (p) => <Icon {...p}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></Icon>;
export const IconStar = (p) => <Icon {...p}><path d="M12 3.5l2.6 5.6 6 .7-4.4 4.1 1.2 6-5.4-3-5.4 3 1.2-6L3.4 9.8l6-.7L12 3.5Z" /></Icon>;
export const IconDot = (p) => <Icon {...p}><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" /></Icon>;
export const IconMenu = (p) => <Icon {...p}><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></Icon>;
export const IconX = (p) => <Icon {...p}><path d="M18 6 6 18" /><path d="M6 6l12 12" /></Icon>;
