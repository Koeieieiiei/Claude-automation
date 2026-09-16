/* ---------- เฟืองเกียร์ (SVG) — โลโก้/ของตกแต่งใช้ร่วมทุกหน้า ---------- */
function gearPath(teeth: number, rOut: number, rIn: number, rHub: number, c = 50) {
  const step = (Math.PI * 2) / teeth;
  let d = "";
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts: [number, number][] = [
      [rIn, a],
      [rOut, a + step * 0.14],
      [rOut, a + step * 0.36],
      [rIn, a + step * 0.5],
      [rIn, a + step],
    ];
    pts.forEach(([r, ang], j) => {
      const x = c + r * Math.cos(ang);
      const y = c + r * Math.sin(ang);
      d += `${i === 0 && j === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `;
    });
  }
  d += "Z ";
  d += `M ${c + rHub} ${c} A ${rHub} ${rHub} 0 1 0 ${c - rHub} ${c} A ${rHub} ${rHub} 0 1 0 ${c + rHub} ${c} Z`;
  return d;
}

export default function Gear({
  teeth = 12,
  className = "",
  spin,
}: {
  teeth?: number;
  className?: string;
  spin?: "cw" | "ccw";
}) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path
        d={gearPath(teeth, 48, 38, 17)}
        fill="currentColor"
        fillRule="evenodd"
        className={spin === "cw" ? "gear-spin" : spin === "ccw" ? "gear-spin-rev" : ""}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
    </svg>
  );
}
