'use client'

import type { AudioFeature, HistogramBin } from '@/lib/spotify-types'

const COLORS = ['#5278E8', '#A78BFA', '#75C9E7', '#7C6AE8', '#8CB6F5', '#B6A4F7']

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex min-h-56 items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500">
      {message}
    </div>
  )
}

export function BarChart({
  data,
  labelKey,
  valueKey,
  horizontal = false,
}: {
  data: Array<Record<string, string | number>>
  labelKey: string
  valueKey: string
  horizontal?: boolean
}) {
  if (!data.length) return <EmptyChart message="Data grafik belum tersedia" />
  const width = 720
  const height = 260
  const padding = { top: 18, right: 20, bottom: 42, left: horizontal ? 92 : 48 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const max = Math.max(...data.map((item) => Number(item[valueKey])), 1)

  return (
    <svg
      aria-label="Bar chart"
      className="h-auto w-full"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padding.top + chartHeight - chartHeight * ratio
        return (
          <g key={ratio}>
            <line
              stroke="#E4E4E7"
              strokeWidth="1"
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
            />
            {!horizontal && (
              <text
                fill="#71717A"
                fontSize="10"
                textAnchor="end"
                x={padding.left - 8}
                y={y + 3}
              >
                {Math.round(max * ratio).toLocaleString('id-ID')}
              </text>
            )}
          </g>
        )
      })}
      {horizontal
        ? data.map((item, index) => {
            const rowHeight = chartHeight / data.length
            const barHeight = Math.min(22, rowHeight * 0.58)
            const barWidth = (Number(item[valueKey]) / max) * chartWidth
            const y = padding.top + index * rowHeight + (rowHeight - barHeight) / 2
            return (
              <g key={`${item[labelKey]}-${index}`}>
                <text
                  fill="#52525B"
                  fontSize="11"
                  textAnchor="end"
                  x={padding.left - 10}
                  y={y + barHeight / 2 + 4}
                >
                  {String(item[labelKey])}
                </text>
                <rect
                  fill={COLORS[index % COLORS.length]}
                  height={barHeight}
                  rx="4"
                  width={barWidth}
                  x={padding.left}
                  y={y}
                />
                <text
                  fill="#52525B"
                  fontSize="10"
                  x={padding.left + barWidth + 7}
                  y={y + barHeight / 2 + 4}
                >
                  {Number(item[valueKey]).toLocaleString('id-ID')}
                </text>
              </g>
            )
          })
        : data.map((item, index) => {
            const slot = chartWidth / data.length
            const barWidth = Math.min(46, slot * 0.62)
            const barHeight = (Number(item[valueKey]) / max) * chartHeight
            const x = padding.left + index * slot + (slot - barWidth) / 2
            const y = padding.top + chartHeight - barHeight
            return (
              <g key={`${item[labelKey]}-${index}`}>
                <rect
                  fill={index === data.length - 1 ? '#A78BFA' : '#5278E8'}
                  height={barHeight}
                  rx="4"
                  width={barWidth}
                  x={x}
                  y={y}
                />
                <text
                  fill="#71717A"
                  fontSize="10"
                  textAnchor="middle"
                  x={x + barWidth / 2}
                  y={height - 17}
                >
                  {String(item[labelKey])}
                </text>
              </g>
            )
          })}
    </svg>
  )
}

export function Histogram({ data }: { data: HistogramBin[] }) {
  if (!data.length) return <EmptyChart message="Distribusi belum tersedia" />
  const width = 360
  const height = 170
  const padding = { top: 12, right: 8, bottom: 28, left: 28 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const max = Math.max(...data.map((item) => item.value), 1)
  const slot = chartWidth / data.length

  return (
    <svg
      aria-label="Histogram"
      className="h-auto w-full"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      {[0, 0.5, 1].map((ratio) => (
        <line
          key={ratio}
          stroke="#E4E4E7"
          x1={padding.left}
          x2={width - padding.right}
          y1={padding.top + chartHeight * (1 - ratio)}
          y2={padding.top + chartHeight * (1 - ratio)}
        />
      ))}
      {data.map((item, index) => {
        const barHeight = (item.value / max) * chartHeight
        return (
          <rect
            fill="#5278E8"
            height={barHeight}
            key={item.label}
            opacity={0.78 + (index / data.length) * 0.2}
            rx="2"
            width={Math.max(slot - 3, 2)}
            x={padding.left + slot * index + 1.5}
            y={padding.top + chartHeight - barHeight}
          />
        )
      })}
      <text fill="#71717A" fontSize="10" x={padding.left} y={height - 8}>
        0.0
      </text>
      <text
        fill="#71717A"
        fontSize="10"
        textAnchor="end"
        x={width - padding.right}
        y={height - 8}
      >
        1.0
      </text>
    </svg>
  )
}

export function ScatterChart({
  points,
}: {
  points: Array<{ x: number; y: number; cluster: number }>
}) {
  if (!points.length) return <EmptyChart message="Data persebaran belum tersedia" />
  const width = 720
  const height = 330
  const left = 48
  const right = 18
  const top = 16
  const bottom = 38
  const chartWidth = width - left - right
  const chartHeight = height - top - bottom

  return (
    <svg
      aria-label="Cluster scatter plot"
      className="h-auto w-full"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
        <g key={ratio}>
          <line
            stroke="#E4E4E7"
            x1={left}
            x2={width - right}
            y1={top + chartHeight * (1 - ratio)}
            y2={top + chartHeight * (1 - ratio)}
          />
          <line
            stroke="#F0F0F1"
            x1={left + chartWidth * ratio}
            x2={left + chartWidth * ratio}
            y1={top}
            y2={height - bottom}
          />
          <text
            fill="#71717A"
            fontSize="10"
            textAnchor="end"
            x={left - 8}
            y={top + chartHeight * (1 - ratio) + 3}
          >
            {ratio.toFixed(2)}
          </text>
          <text
            fill="#71717A"
            fontSize="10"
            textAnchor="middle"
            x={left + chartWidth * ratio}
            y={height - 18}
          >
            {ratio.toFixed(2)}
          </text>
        </g>
      ))}
      {points.map((point, index) => (
        <circle
          cx={left + clamp01(point.x) * chartWidth}
          cy={top + (1 - clamp01(point.y)) * chartHeight}
          fill={COLORS[Math.abs(point.cluster) % COLORS.length]}
          key={`${point.cluster}-${index}`}
          opacity="0.68"
          r="3.5"
        />
      ))}
      <text
        fill="#52525B"
        fontSize="11"
        fontWeight="600"
        textAnchor="middle"
        x={left + chartWidth / 2}
        y={height - 2}
      >
        Danceability
      </text>
      <text
        fill="#52525B"
        fontSize="11"
        fontWeight="600"
        textAnchor="middle"
        transform={`rotate(-90 12 ${top + chartHeight / 2})`}
        x="12"
        y={top + chartHeight / 2}
      >
        Energy
      </text>
    </svg>
  )
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

export function Heatmap({
  profiles,
  features,
}: {
  profiles: Array<{
    cluster: number
    values: Record<AudioFeature, number>
  }>
  features: readonly AudioFeature[]
}) {
  if (!profiles.length) return <EmptyChart message="Profil cluster belum tersedia" />
  const cellWidth = 94
  const cellHeight = 42
  const labelWidth = 92
  const top = 56
  const width = labelWidth + features.length * cellWidth
  const height = top + profiles.length * cellHeight + 10

  const colorFor = (value: number) => {
    const intensity = Math.min(1, Math.abs(value) / 1.8)
    if (value >= 0) {
      return `rgba(167, 139, 250, ${0.12 + intensity * 0.8})`
    }
    return `rgba(82, 120, 232, ${0.12 + intensity * 0.76})`
  }

  return (
    <div className="overflow-x-auto">
      <svg
        aria-label="Cluster profile heatmap"
        className="min-w-[920px]"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        {features.map((feature, index) => (
          <text
            fill="#52525B"
            fontSize="10"
            fontWeight="600"
            key={feature}
            textAnchor="middle"
            transform={`rotate(-28 ${labelWidth + index * cellWidth + cellWidth / 2} ${top - 8})`}
            x={labelWidth + index * cellWidth + cellWidth / 2}
            y={top - 8}
          >
            {feature}
          </text>
        ))}
        {profiles.map((profile, row) => (
          <g key={profile.cluster}>
            <text
              fill="#3F3F46"
              fontSize="11"
              fontWeight="600"
              textAnchor="end"
              x={labelWidth - 12}
              y={top + row * cellHeight + cellHeight / 2 + 4}
            >
              Cluster {profile.cluster}
            </text>
            {features.map((feature, column) => {
              const value = profile.values[feature]
              return (
                <g key={feature}>
                  <rect
                    fill={colorFor(value)}
                    height={cellHeight - 3}
                    rx="4"
                    width={cellWidth - 3}
                    x={labelWidth + column * cellWidth}
                    y={top + row * cellHeight}
                  />
                  <text
                    fill={Math.abs(value) > 0.78 ? '#FFFFFF' : '#3F3F46'}
                    fontSize="10"
                    fontWeight="600"
                    textAnchor="middle"
                    x={labelWidth + column * cellWidth + (cellWidth - 3) / 2}
                    y={top + row * cellHeight + cellHeight / 2 + 3}
                  >
                    {value.toFixed(2)}
                  </text>
                </g>
              )
            })}
          </g>
        ))}
      </svg>
    </div>
  )
}

export function LineChart({
  data,
  field,
  selectedK,
  color = '#5278E8',
}: {
  data: Array<{ k: number; silhouette: number; daviesBouldin: number }>
  field: 'silhouette' | 'daviesBouldin'
  selectedK: number | null
  color?: string
}) {
  if (!data.length) return <EmptyChart message="File k_selection.csv belum tersedia" />
  const width = 520
  const height = 240
  const left = 46
  const right = 18
  const top = 18
  const bottom = 36
  const values = data.map((item) => item[field])
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const range = maximum - minimum || 1
  const xFor = (index: number) =>
    left + (index / Math.max(data.length - 1, 1)) * (width - left - right)
  const yFor = (value: number) =>
    top + (1 - (value - minimum) / range) * (height - top - bottom)
  const path = data
    .map((item, index) => `${index ? 'L' : 'M'} ${xFor(index)} ${yFor(item[field])}`)
    .join(' ')

  return (
    <svg
      aria-label={`${field} line chart`}
      className="h-auto w-full"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      {[0, 0.5, 1].map((ratio) => {
        const y = top + ratio * (height - top - bottom)
        const value = maximum - ratio * range
        return (
          <g key={ratio}>
            <line stroke="#E4E4E7" x1={left} x2={width - right} y1={y} y2={y} />
            <text fill="#71717A" fontSize="10" textAnchor="end" x={left - 8} y={y + 3}>
              {value.toFixed(2)}
            </text>
          </g>
        )
      })}
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" />
      {data.map((item, index) => {
        const selected = item.k === selectedK
        return (
          <g key={item.k}>
            <circle
              cx={xFor(index)}
              cy={yFor(item[field])}
              fill={selected ? '#18181B' : '#FFFFFF'}
              r={selected ? 6 : 4}
              stroke={selected ? '#18181B' : color}
              strokeWidth="2"
            />
            <text
              fill="#71717A"
              fontSize="10"
              textAnchor="middle"
              x={xFor(index)}
              y={height - 14}
            >
              k={item.k}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function TimingChart({
  allMs,
  clusterMs,
}: {
  allMs: number | null
  clusterMs: number | null
}) {
  if (allMs === null || clusterMs === null) {
    return <EmptyChart message="Metrik waktu belum tersedia" />
  }
  return (
    <BarChart
      data={[
        { label: 'Semua lagu', value: allMs },
        { label: 'Satu cluster', value: clusterMs },
      ]}
      labelKey="label"
      valueKey="value"
    />
  )
}

export function MoodProfileChart({
  data,
}: {
  data: Array<{ label: string; mood: number; catalog: number }>
}) {
  if (!data.length) return <EmptyChart message="Profil mood belum tersedia" />
  const width = 760
  const height = 330
  const padding = { top: 28, right: 28, bottom: 54, left: 42 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const xFor = (index: number) =>
    padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth
  const yFor = (value: number) =>
    padding.top + (1 - clamp01(value)) * chartHeight
  const moodPath = data
    .map((item, index) => `${index ? 'L' : 'M'} ${xFor(index)} ${yFor(item.mood)}`)
    .join(' ')
  const catalogPath = data
    .map(
      (item, index) =>
        `${index ? 'L' : 'M'} ${xFor(index)} ${yFor(item.catalog)}`,
    )
    .join(' ')

  return (
    <svg
      aria-label="Mood feature profile"
      className="h-auto w-full"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = yFor(ratio)
        return (
          <g key={ratio}>
            <line
              stroke="rgba(184, 194, 233, 0.15)"
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
            />
            <text
              fill="#9DA9D3"
              fontSize="10"
              textAnchor="end"
              x={padding.left - 9}
              y={y + 3}
            >
              {ratio.toFixed(2)}
            </text>
          </g>
        )
      })}
      {data.map((item, index) => (
        <line
          key={item.label}
          stroke="rgba(184, 194, 233, 0.08)"
          x1={xFor(index)}
          x2={xFor(index)}
          y1={padding.top}
          y2={height - padding.bottom}
        />
      ))}
      <path
        d={catalogPath}
        fill="none"
        stroke="#75C9E7"
        strokeDasharray="6 6"
        strokeWidth="2"
      />
      <path d={moodPath} fill="none" stroke="#A78BFA" strokeWidth="3" />
      {data.map((item, index) => (
        <g key={item.label}>
          <circle
            cx={xFor(index)}
            cy={yFor(item.catalog)}
            fill="#75C9E7"
            r="3"
          />
          <circle
            cx={xFor(index)}
            cy={yFor(item.mood)}
            fill="#A78BFA"
            r="4.5"
            stroke="#17183F"
            strokeWidth="2"
          />
          <text
            fill="#C6CDEC"
            fontSize="10"
            fontWeight="600"
            textAnchor="middle"
            x={xFor(index)}
            y={height - 24}
          >
            {item.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
