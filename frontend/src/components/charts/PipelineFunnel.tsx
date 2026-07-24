'use client';

import * as React from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ApplicationStats } from '../../services/applications';
import { useChartPalette } from './useChartPalette';
import ChartCard from './ChartCard';

const STAGES = [
  { key: 'wishlist', label: 'Wishlist' },
  { key: 'applied', label: 'Applied' },
  { key: 'interviewing', label: 'Interviewing' },
  { key: 'offered', label: 'Offered' },
] as const;

interface PipelineFunnelProps {
  stats: ApplicationStats | undefined;
  loading?: boolean;
  refreshing?: boolean;
}

export default function PipelineFunnel({ stats, loading, refreshing }: PipelineFunnelProps) {
  const palette = useChartPalette();

  const data = React.useMemo(
    () =>
      STAGES.map((stage, i) => {
        const count = stats ? stats[stage.key] : 0;
        const prev = i > 0 && stats ? stats[STAGES[i - 1].key] : null;
        return {
          stage: stage.label,
          count,
          conversion:
            prev && prev > 0 ? `${Math.round((count / prev) * 100)}% from previous` : null,
        };
      }),
    [stats]
  );
  const empty = !loading && data.every((d) => d.count === 0);

  return (
    <ChartCard
      title="Pipeline"
      subtitle="Where your applications stand"
      loading={loading}
      refreshing={refreshing}
      empty={empty}
      height={248}
    >
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, left: 8, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="stage"
            width={88}
            tick={{ fill: palette.axisText, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: palette.grid }}
            contentStyle={{
              background: palette.tooltipBg,
              border: `1px solid ${palette.tooltipBorder}`,
              borderRadius: 8,
              fontSize: 12,
              color: palette.labelText,
            }}
            formatter={(value, _name, entry) => {
              const conversion = (entry?.payload as { conversion: string | null })?.conversion;
              return [conversion ? `${value} · ${conversion}` : value, 'Applications'];
            }}
          />
          <Bar dataKey="count" barSize={22} radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={palette.funnel[i] ?? palette.c1} />
            ))}
            <LabelList
              dataKey="count"
              position="right"
              style={{ fill: palette.labelText, fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {stats && (stats.rejected > 0 || stats.withdrawn > 0) && (
        <Stack direction="row" spacing={2} sx={{ pl: 1, pt: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Rejected: {stats.rejected}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Withdrawn: {stats.withdrawn}
          </Typography>
        </Stack>
      )}
    </ChartCard>
  );
}
