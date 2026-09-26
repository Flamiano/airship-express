"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";

type Coordinate = [number, number];

const TILE = 256;
const PAD = 32; // px of breathing room around the markers
const SINGLE_POINT_ZOOM = 10;
const MAX_ZOOM = 15;

// Web-Mercator projection → world pixel coordinates at zoom z.
function project(lat: number, lon: number, z: number) {
  const size = TILE * 2 ** z;
  const clamped = Math.max(-85.0511, Math.min(85.0511, lat));
  const s = Math.sin((clamped * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * size,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size,
  };
}

type Props = {
  origin: Coordinate | null;
  destination: Coordinate | null;
  isDark: boolean;
  loading?: boolean;
  originLabel?: string;
  destinationLabel?: string;
  height?: number;
  /** Small thumbnail mode (table rows): smaller markers, no text placeholder. */
  compact?: boolean;
};

export default function MiniRouteMap({
  origin,
  destination,
  isDark,
  loading = false,
  originLabel,
  destinationLabel,
  height = 180,
  compact = false,
}: Props) {
  const markerR = compact ? 7 : 10;
  const markerFont = compact ? 8 : 10;
  const pad = compact ? 16 : PAD;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // If the shortest path crosses the date line (e.g. Shanghai → Los Angeles), shift the destination by ±360°.
  let dest = destination;
  if (origin && destination && Math.abs(destination[1] - origin[1]) > 180) {
    dest = [destination[0], destination[1] + (destination[1] < origin[1] ? 360 : -360)];
  }

  const points: { key: "origin" | "destination"; coord: Coordinate }[] = [];
  if (origin) points.push({ key: "origin", coord: origin });
  if (dest) points.push({ key: "destination", coord: dest });

  const border = isDark ? "border-[#2C4356]" : "border-gray-200";
  const muted = isDark ? "text-[#8FA0AF]" : "text-gray-500";

  let content: React.ReactNode = null;

  if (points.length > 0 && width > 0) {
    // Pick the highest zoom where every marker fits inside the box.
    let zoom = SINGLE_POINT_ZOOM;
    if (points.length > 1) {
      zoom = 1;
      for (let z = MAX_ZOOM; z >= 1; z--) {
        const px = points.map((p) => project(p.coord[0], p.coord[1], z));
        const dx = Math.abs(px[0].x - px[1].x);
        const dy = Math.abs(px[0].y - px[1].y);
        if (dx <= width - pad * 2 && dy <= height - pad * 2) {
          zoom = z;
          break;
        }
      }
    }

    const projected = points.map((p) => ({ ...p, ...project(p.coord[0], p.coord[1], zoom) }));
    const xs = projected.map((p) => p.x);
    const ys = projected.map((p) => p.y);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const left = centerX - width / 2;
    const top = centerY - height / 2;

    const n = 2 ** zoom;
    const tiles: { key: string; src: string; x: number; y: number }[] = [];
    const tx0 = Math.floor(left / TILE);
    const tx1 = Math.floor((left + width) / TILE);
    const ty0 = Math.max(0, Math.floor(top / TILE));
    const ty1 = Math.min(n - 1, Math.floor((top + height) / TILE));
    for (let tx = tx0; tx <= tx1; tx++) {
      const wrappedX = ((tx % n) + n) % n;
      for (let ty = ty0; ty <= ty1; ty++) {
        tiles.push({
          key: `${zoom}-${tx}-${ty}`,
          src: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`,
          x: tx * TILE - left,
          y: ty * TILE - top,
        });
      }
    }

    const screen = projected.map((p) => ({ key: p.key, x: p.x - left, y: p.y - top }));
    const o = screen.find((p) => p.key === "origin");
    const d = screen.find((p) => p.key === "destination");

    content = (
      <>
        <div
          className="absolute inset-0"
          style={isDark ? { filter: "invert(0.9) hue-rotate(180deg) brightness(0.95) contrast(0.9)" } : undefined}
        >
          {tiles.map((t) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={t.key}
              src={t.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{ left: t.x, top: t.y, width: TILE, height: TILE }}
            />
          ))}
        </div>

        <svg className="pointer-events-none absolute inset-0" width={width} height={height}>
          {o && d && (
            <line x1={o.x} y1={o.y} x2={d.x} y2={d.y} stroke="#F2419B" strokeWidth={2.5} strokeDasharray="6 5" strokeLinecap="round" />
          )}
          {screen.map((p) => (
            <g key={p.key}>
              <circle cx={p.x} cy={p.y} r={markerR} fill={p.key === "origin" ? "#1FA968" : "#F2419B"} stroke="white" strokeWidth={compact ? 2 : 2.5} />
              <text x={p.x} y={p.y + markerFont * 0.35} textAnchor="middle" fontSize={markerFont} fontWeight={700} fill="white">
                {p.key === "origin" ? "A" : "B"}
              </text>
            </g>
          ))}
        </svg>

        {/* Hover tooltips */}
        {screen.map((p) => (
          <div
            key={`hit-${p.key}`}
            title={p.key === "origin" ? `Origin: ${originLabel || ""}` : `Destination: ${destinationLabel || ""}`}
            className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: p.x, top: p.y }}
          />
        ))}

        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`absolute right-0 bottom-0 bg-white/80 px-1 text-gray-600 hover:underline ${compact ? "text-[7px] leading-tight" : "text-[9px]"}`}
        >
          {compact ? "© OSM" : "© OpenStreetMap"}
        </a>
      </>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative w-full overflow-hidden rounded-md border ${border} ${isDark ? "bg-[#0B1220]" : "bg-[#EEF2F5]"}`}
      style={{ height }}
    >
      {content}

      {points.length === 0 && !loading && (
        <div className={`absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-xs ${muted}`}>
          <MapPin size={compact ? 16 : 18} />
          {!compact && "Enter or pick an origin and destination to preview the route"}
        </div>
      )}

      {loading && compact && points.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={16} className="animate-spin text-[#F2419B]" />
        </div>
      )}

      {loading && !compact && (
        <div
          className={`absolute top-2 left-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium shadow ${
            isDark ? "bg-[#121B26] text-[#C7D1DA]" : "bg-white text-gray-600"
          }`}
        >
          <Loader2 size={12} className="animate-spin text-[#F2419B]" />
          Finding location…
        </div>
      )}
    </div>
  );
}
