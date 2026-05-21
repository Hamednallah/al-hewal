'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface AnalyticsBarDatum {
  /** Display label for the bar (already i18n-resolved by the caller). */
  label: string;
  /** Numeric height. */
  value: number;
}

interface AnalyticsBarChartProps {
  data: AnalyticsBarDatum[];
  ariaLabel: string;
  emptyMessage: string;
  dir: 'ltr' | 'rtl';
}

/**
 * Horizontal-leaning vertical bar chart for source-mix and top-cities.
 * Reusable: caller flattens its domain rows to `{ label, value }`
 * before passing them in, so this component never has to know whether
 * it's rendering sources or cities or anything else.
 *
 * Empty-state: if every value is zero (or the array is empty), render
 * an overlay message instead of an axis-only ghost chart.
 */
export function AnalyticsBarChart({ data, ariaLabel, emptyMessage, dir }: AnalyticsBarChartProps) {
  const allZero = data.length === 0 || data.every((d) => d.value === 0);

  return (
    <div className="relative h-[280px] w-full" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
          <XAxis
            dataKey="label"
            stroke="#2D2D2D"
            fontSize={11}
            reversed={dir === 'rtl'}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={50}
          />
          <YAxis
            allowDecimals={false}
            stroke="#2D2D2D"
            fontSize={11}
            orientation={dir === 'rtl' ? 'right' : 'left'}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#002B2B',
              border: 'none',
              color: '#F9F9F9',
              fontSize: 12,
            }}
            labelStyle={{ color: '#D4B982' }}
            cursor={{ fill: 'rgba(0,43,43,0.05)' }}
          />
          <Bar dataKey="value" fill="#002B2B" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      {allZero ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="bg-canvas-raised/90 text-charcoal-muted border-outline-variant/40 border px-4 py-2 text-sm">
            {emptyMessage}
          </p>
        </div>
      ) : null}
    </div>
  );
}
