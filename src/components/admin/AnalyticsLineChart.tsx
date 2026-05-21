'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { LeadsPerDayPoint } from '@/lib/data/admin-analytics';

interface AnalyticsLineChartProps {
  /** 30 points, zero-filled. Order is oldest → newest. */
  data: LeadsPerDayPoint[];
  /** Locale-specific axis labels passed in by the server component. */
  axisDateLabel: string;
  axisLeadCountLabel: string;
  emptyMessage: string;
  /** Render direction — RTL chart flips axis position. */
  dir: 'ltr' | 'rtl';
}

/**
 * Line chart of leads-per-day over the last 30 days. Client component
 * because Recharts needs DOM measurement for `ResponsiveContainer`.
 * Hydrates with the `data` array passed by the server-side page;
 * never fetches on the client.
 *
 * Empty-state behavior: if every point's `leadCount` is zero, render
 * the chart axes + an overlay message inside the plot area rather
 * than a flat line at y=0 (which reads as "data missing", not "no
 * leads yet").
 */
export function AnalyticsLineChart({
  data,
  axisDateLabel,
  axisLeadCountLabel,
  emptyMessage,
  dir,
}: AnalyticsLineChartProps) {
  const allZero = data.every((p) => p.leadCount === 0);

  return (
    <div className="relative h-[280px] w-full" role="img" aria-label={axisLeadCountLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
          // Recharts has no native RTL flip; we reverse the x-axis so
          // the most-recent day sits on the inline-end for AR users.
          reverseStackOrder={dir === 'rtl'}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
          <XAxis
            dataKey="date"
            tickFormatter={(iso: string) => iso.slice(5)}
            label={{ value: axisDateLabel, position: 'insideBottom', offset: -4, fontSize: 12 }}
            stroke="#2D2D2D"
            fontSize={11}
            reversed={dir === 'rtl'}
          />
          <YAxis
            allowDecimals={false}
            label={{
              value: axisLeadCountLabel,
              angle: -90,
              position: 'insideLeft',
              fontSize: 12,
            }}
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
          />
          <Line
            type="monotone"
            dataKey="leadCount"
            stroke="#002B2B"
            strokeWidth={2}
            dot={{ fill: '#D4B982', r: 3 }}
            activeDot={{ r: 5, fill: '#D4B982' }}
            isAnimationActive={false}
          />
        </LineChart>
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
