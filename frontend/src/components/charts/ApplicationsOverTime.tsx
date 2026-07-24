'use client';

import * as React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { JobApplication } from '../../services/applications';
import { useChartPalette } from './useChartPalette';
import ChartCard from './ChartCard';

const WEEKS = 12;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface WeekBucket {
  label: string;
  count: number;
}

function buildWeeklySeries(applications: JobApplication[]): WeekBucket[] {
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  const buckets: { start: number; label: string; count: number }[] = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const start = monday.getTime() - i * WEEK_MS;
    buckets.push({
      start,
      label: new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      count: 0,
    });
  }
  const first = buckets[0].start;
  for (const app of applications) {
    const t = new Date(app.created_at).getTime();
    if (Number.isNaN(t) || t < first) continue;
    const index = Math.min(Math.floor((t - first) / WEEK_MS), WEEKS - 1);
    buckets[index].count += 1;
  }
  return buckets.map(({ label, count }) => ({ label, count }));
}

interface ApplicationsOverTimeProps {
  applications: JobApplication[] | undefined;
  loading?: boolean;
  refreshing?: boolean;
}

export default function ApplicationsOverTime({
  applications,
  loading,
  refreshing,
}: ApplicationsOverTimeProps) {
  const palette = useChartPalette();
  const data = React.useMemo(
    () => buildWeeklySeries(applications ?? []),
    [applications]
  );
  const empty = !loading && data.every((d) => d.count === 0);

  return (
    <ChartCard
      title="Applications over time"
      subtitle={`Added per week, last ${WEEKS} weeks`}
      loading={loading}
      refreshing={refreshing}
      empty={empty}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={palette.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: palette.axisText, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: palette.axisText, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ stroke: palette.grid }}
            contentStyle={{
              background: palette.tooltipBg,
              border: `1px solid ${palette.tooltipBorder}`,
              borderRadius: 8,
              fontSize: 12,
              color: palette.labelText,
            }}
            formatter={(value) => [value as number, 'Applications']}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={palette.c1}
            strokeWidth={2}
            strokeLinecap="round"
            fill={palette.c1}
            fillOpacity={0.12}
            dot={false}
            activeDot={{ r: 4, fill: palette.c1, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
