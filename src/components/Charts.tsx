import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { compact, money } from '../lib/format'

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

export interface Series { name: string; color: string; values: number[] }

function niceMax(v: number) {
  if (v <= 0) return 100
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p
}

function Tooltip({ x, title, rows, width }: { x: number; title: string; rows: { name: string; color: string; value: number }[]; width: number }) {
  const left = Math.min(Math.max(x, 80), Math.max(width - 80, 80))
  return (
    <div className="glass-strong pointer-events-none absolute z-10 -translate-x-1/2 rounded-2xl px-3 py-2 text-[12.5px]" style={{ left, top: 4, minWidth: 130 }}>
      <div className="font-semibold mb-1 capitalize">{title}</div>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-ink2"><i className="dot" style={{ background: r.color }} />{r.name}</span>
          <span className="num money font-medium">{money(r.value)}</span>
        </div>
      ))}
    </div>
  )
}

/** Barras agrupadas (receita / despesa / investimento por periodo). */
export function BarChart({ labels, series, height = 230 }: { labels: string[]; series: Series[]; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const uid = useId().replace(/:/g, '')
  const padL = 44, padB = 24, padT = 10, padR = 4
  const innerW = Math.max(w - padL - padR, 10)
  const innerH = height - padB - padT
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)))
  const n = labels.length
  const slot = innerW / Math.max(n, 1)
  const groupW = Math.min(slot * 0.74, 56)
  const barW = Math.max(Math.min(groupW / series.length - 2, 22), 2)
  const y = (v: number) => padT + innerH - (v / max) * innerH
  const every = Math.ceil(n / Math.max(Math.floor(innerW / 38), 1))
  const ticks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}
      onMouseLeave={() => setHover(null)}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label="Gráfico de barras">
          <defs>
            {series.map((s, i) => (
              <linearGradient key={i} id={`${uid}b${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity="1" />
                <stop offset="1" stopColor={s.color} stopOpacity="0.55" />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={y(max * t)} y2={y(max * t)} stroke="var(--hair)" strokeDasharray={t === 0 ? '' : '3 4'} />
              <text x={padL - 8} y={y(max * t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">{compact(max * t)}</text>
            </g>
          ))}
          {labels.map((l, i) => {
            const cx = padL + slot * i + slot / 2
            const active = hover === i
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
                <rect x={padL + slot * i} y={padT} width={slot} height={innerH + padB} fill={active ? 'var(--field)' : 'transparent'} rx="8" />
                {series.map((s, si) => {
                  const bx = cx - (barW * series.length + 2 * (series.length - 1)) / 2 + si * (barW + 2)
                  const h = Math.max((s.values[i] / max) * innerH, s.values[i] > 0 ? 2 : 0)
                  const r = Math.min(barW / 2, 6)
                  return h > 0 ? (
                    <path key={si} fill={`url(#${uid}b${si})`}
                      d={`M${bx},${padT + innerH} V${padT + innerH - h + r} Q${bx},${padT + innerH - h} ${bx + r},${padT + innerH - h} H${bx + barW - r} Q${bx + barW},${padT + innerH - h} ${bx + barW},${padT + innerH - h + r} V${padT + innerH} Z`} />
                  ) : null
                })}
                {i % every === 0 && (
                  <text x={cx} y={height - 6} textAnchor="middle" fontSize="11" fill={active ? 'var(--ink)' : 'var(--ink-2)'} style={{ textTransform: 'capitalize' }}>{l}</text>
                )}
              </g>
            )
          })}
        </svg>
      )}
      {hover !== null && w > 0 && (
        <Tooltip x={padL + slot * hover + slot / 2} width={w} title={labels[hover]}
          rows={series.map((s) => ({ name: s.name, color: s.color, value: s.values[hover] }))} />
      )}
    </div>
  )
}

/** Linhas com area suave (evolucao do saldo / patrimonio). */
export function LineChart({ labels, series, height = 230 }: { labels: string[]; series: Series[]; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const uid = useId().replace(/:/g, '')
  const padL = 44, padB = 24, padT = 10, padR = 10
  const innerW = Math.max(w - padL - padR, 10)
  const innerH = height - padB - padT
  const all = series.flatMap((s) => s.values)
  const rawMax = Math.max(0, ...all)
  const rawMin = Math.min(0, ...all)
  const max = niceMax(rawMax || 1)
  const min = rawMin < 0 ? -niceMax(-rawMin) : 0
  const n = labels.length
  const x = (i: number) => padL + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1))
  const y = (v: number) => padT + innerH - ((v - min) / (max - min || 1)) * innerH
  const every = Math.ceil(n / Math.max(Math.floor(innerW / 44), 1))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + (max - min) * t)

  const smooth = (vals: number[]) => {
    const pts = vals.map((v, i) => [x(i), y(v)] as const)
    if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`
    let d = `M${pts[0][0]},${pts[0][1]}`
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]
      const cx = (x0 + x1) / 2
      d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`
    }
    return d
  }

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        const px = e.clientX - r.left
        const i = Math.round(((px - padL) / innerW) * (n - 1))
        setHover(Math.max(0, Math.min(n - 1, i)))
      }}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label="Gráfico de linhas">
          <defs>
            {series.map((s, i) => (
              <linearGradient key={i} id={`${uid}a${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity="0.28" />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="var(--hair)" strokeDasharray={t === 0 ? '' : '3 4'} />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">{compact(t)}</text>
            </g>
          ))}
          {series.map((s, i) => (
            <g key={i}>
              {n > 1 && <path d={`${smooth(s.values)} L${x(n - 1)},${y(Math.max(min, 0))} L${x(0)},${y(Math.max(min, 0))} Z`} fill={`url(#${uid}a${i})`} />}
              <path d={smooth(s.values)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" />
            </g>
          ))}
          {labels.map((l, i) => i % every === 0 && (
            <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--ink-2)" style={{ textTransform: 'capitalize' }}>{l}</text>
          ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + innerH} stroke="var(--ink-3)" strokeDasharray="3 3" />
              {series.map((s, i) => <circle key={i} cx={x(hover)} cy={y(s.values[hover])} r="5" fill="var(--bg)" stroke={s.color} strokeWidth="2.5" />)}
            </g>
          )}
        </svg>
      )}
      {hover !== null && w > 0 && (
        <Tooltip x={x(hover)} width={w} title={labels[hover]} rows={series.map((s) => ({ name: s.name, color: s.color, value: s.values[hover] }))} />
      )}
    </div>
  )
}

export interface Slice { label: string; value: number; color: string; icon?: string }

export function Donut({ slices, size = 180, thickness = 22, children, onHover }: {
  slices: Slice[]; size?: number; thickness?: number; children?: ReactNode; onHover?: (i: number | null) => void
}) {
  const total = slices.reduce((a, s) => a + s.value, 0)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const [hover, setHover] = useState<number | null>(null)
  let offset = 0
  const gap = slices.length > 1 ? 3 : 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--field)" strokeWidth={thickness} />
        {total > 0 && slices.map((s, i) => {
          const len = (s.value / total) * c
          const dash = Math.max(len - gap, 0.5)
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color}
              strokeWidth={hover === i ? thickness + 4 : thickness} strokeLinecap="round"
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset}
              style={{ transition: 'stroke-width .15s', opacity: hover === null || hover === i ? 1 : 0.45 }}
              onMouseEnter={() => { setHover(i); onHover?.(i) }} onMouseLeave={() => { setHover(null); onHover?.(null) }} />
          )
          offset += len
          return el
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center pointer-events-none">{children}</div>
    </div>
  )
}

export function Sparkline({ values, color, width = 90, height = 28 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return null
  const max = Math.max(...values), min = Math.min(...values)
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 3 - ((v - min) / (max - min || 1)) * (height - 6)])
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <svg width={width} height={height}>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
