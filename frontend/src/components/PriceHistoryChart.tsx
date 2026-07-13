'use client';

import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { Product } from '@/types';
import { formatCents } from '@/lib/utils';
import { buildPriceSeries, windowSeries } from '@/lib/priceForecast';

type Range = '30d' | '90d' | 'all';

function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface TooltipEntry {
  payload: { date: number; price?: number; forecast?: number; range?: [number, number] };
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  const isForecast = p.price == null && p.forecast != null;
  const value = p.price ?? p.forecast;
  if (value == null) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white/95 backdrop-blur px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-400 mb-0.5">{fmtDate(p.date)}</p>
      <p className="font-extrabold text-gray-900 text-sm">{formatCents(value)}</p>
      {isForecast && p.range && (
        <p className="text-gray-400 mt-0.5">
          Range {formatCents(p.range[0])} – {formatCents(p.range[1])}
        </p>
      )}
      <p className={`mt-0.5 font-bold uppercase tracking-wide text-[9px] ${isForecast ? 'text-indigo-500' : 'text-gray-400'}`}>
        {isForecast ? 'Forecast' : 'Actual'}
      </p>
    </div>
  );
}

export default function PriceHistoryChart({ product }: { product: Product }) {
  const [range, setRange] = useState<Range>('90d');
  const series = useMemo(() => buildPriceSeries(product, 30), [product]);

  const data = useMemo(
    () =>
      windowSeries(series, range).map((p) => ({
        date: p.date,
        price: p.price,
        forecast: p.forecast,
        range: p.lower != null && p.upper != null ? [p.lower, p.upper] : undefined,
      })),
    [series, range]
  );

  const { stats } = series;
  const up = stats.direction === 'up';
  const down = stats.direction === 'down';
  const trendColor = stats.trendPct > 0 ? 'text-red-600' : stats.trendPct < 0 ? 'text-green-600' : 'text-gray-500';

  return (
    <div className="space-y-6">
      {/* Header: current price, trend, forecast summary */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Current Price</p>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-extrabold text-gray-900">{formatCents(stats.current)}</span>
            <span className={`text-sm font-bold ${trendColor}`}>
              {stats.trendPct > 0 ? '▲' : stats.trendPct < 0 ? '▼' : '—'} {Math.abs(stats.trendPct).toFixed(1)}%
              <span className="text-gray-400 font-semibold"> over period</span>
            </span>
          </div>
        </div>

        {/* Range selector */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 self-start">
          {(['30d', '90d', 'all'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                range === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {r === 'all' ? 'All' : r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Forecast callout */}
      <div
        className={`flex items-start gap-3 rounded-2xl border p-4 ${
          down ? 'bg-green-50 border-green-200' : up ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'
        }`}
      >
        <div className={`mt-0.5 shrink-0 ${down ? 'text-green-600' : up ? 'text-amber-600' : 'text-gray-500'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            {down ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            ) : up ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
            )}
          </svg>
        </div>
        <div className="text-sm">
          <p className="font-bold text-gray-900">
            {stats.forecastPrice != null ? (
              <>
                Estimated {formatCents(stats.forecastPrice)} in 30 days
                {stats.forecastDeltaPct != null && Math.abs(stats.forecastDeltaPct) >= 0.5 && (
                  <span className={down ? 'text-green-700' : 'text-amber-700'}>
                    {' '}({stats.forecastDeltaPct > 0 ? '+' : ''}
                    {stats.forecastDeltaPct.toFixed(1)}%)
                  </span>
                )}
              </>
            ) : (
              'Not enough data to forecast'
            )}
          </p>
          <p className="text-gray-500 mt-0.5">
            {down
              ? 'Price is trending down — it may be worth waiting for a better deal.'
              : up
              ? 'Price is trending up — buying sooner could save you money.'
              : 'Price has been stable recently.'}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#111827" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#111827" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="date"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={fmtDate}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              tickFormatter={(v: number) => formatCents(v)}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={64}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<ChartTooltip />} />

            {/* Confidence band */}
            <Area
              dataKey="range"
              stroke="none"
              fill="#6366f1"
              fillOpacity={0.12}
              connectNulls
              isAnimationActive={false}
            />

            {/* Min / max markers */}
            <ReferenceLine
              y={stats.max}
              stroke="#f87171"
              strokeDasharray="4 4"
              label={{ value: `High ${formatCents(stats.max)}`, position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }}
            />
            <ReferenceLine
              y={stats.min}
              stroke="#34d399"
              strokeDasharray="4 4"
              label={{ value: `Low ${formatCents(stats.min)}`, position: 'insideBottomRight', fontSize: 10, fill: '#10b981' }}
            />

            {/* Historical price */}
            <Area
              dataKey="price"
              stroke="#111827"
              strokeWidth={2.5}
              fill="url(#priceFill)"
              connectNulls={false}
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4, fill: '#111827' }}
            />

            {/* Forecast (dashed) */}
            <Line
              dataKey="forecast"
              stroke="#6366f1"
              strokeWidth={2.5}
              strokeDasharray="6 5"
              connectNulls={false}
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4, fill: '#6366f1' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Stat footer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Lowest', value: formatCents(stats.min), c: 'text-green-600' },
          { label: 'Highest', value: formatCents(stats.max), c: 'text-red-600' },
          { label: 'Average', value: formatCents(stats.avg), c: 'text-gray-900' },
          { label: '30-day est.', value: stats.forecastPrice != null ? formatCents(stats.forecastPrice) : '—', c: 'text-indigo-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-gray-150 bg-white p-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
            <p className={`text-lg font-extrabold ${s.c}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Legend + disclaimer */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 border-t border-gray-100 pt-4">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-gray-900 rounded" /> Actual price
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 border-t-2 border-dashed border-indigo-500" /> Forecast
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-indigo-500/20 rounded-sm" /> Confidence band
        </span>
        {series.synthesized && (
          <span className="ml-auto italic">Illustrative history — real tracking begins once prices change.</span>
        )}
      </div>
    </div>
  );
}
