import { cn } from "@/lib/utils";

export function PlaceholderImage({
  label,
  tone = "day",
  className,
}: {
  label?: string;
  tone?: "day" | "night" | "neutral";
  className?: string;
}) {
  const bg = tone === "night"
    ? "linear-gradient(180deg,#0e1522 0%, #1c2436 60%, #2a3350 100%)"
    : tone === "day"
      ? "linear-gradient(180deg,#eef2f5 0%, #f7f6f2 55%, #ede8dd 100%)"
      : "linear-gradient(180deg,#f5f5f2 0%, #ecece7 100%)";
  const line = tone === "night" ? "rgba(255,255,255,0.14)" : "rgba(17,17,17,0.08)";
  const text = tone === "night" ? "text-white/70" : "text-adinn-muted";
  return (
    <div className={cn("relative w-full h-full overflow-hidden", className)} style={{ background: bg }} aria-hidden="true">
      <div className="absolute inset-x-0 top-[62%] h-px" style={{ background: line }} />
      <div className="absolute" style={{ left: "50%", transform: "translateX(-50%)", top: "20%", bottom: 0, width: 5, background: line }} />
      <div className="absolute border" style={{ left: "22%", right: "22%", top: "12%", height: "34%", borderColor: line, background: tone === "night" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)" }}>
        <div className="h-full w-full flex items-center justify-center">
          <span className={cn("text-xs tracking-[0.35em] uppercase font-medium", text)}>ADINN</span>
        </div>
      </div>
      {label && (
        <div className={cn("absolute bottom-3 left-3 text-[10px] uppercase tracking-widest", text)}>{label}</div>
      )}
    </div>
  );
}