'use client';

import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LanguageIcon from '@mui/icons-material/Language';
import WorkOutlineIcon from '@mui/icons-material/WorkOutlined';
import BusinessIcon from '@mui/icons-material/Business';
import PlaceIcon from '@mui/icons-material/Place';
import GroupsIcon from '@mui/icons-material/Groups';
import type { ScraperTarget } from '../../services/scraper';

interface TargetCardProps {
  target: ScraperTarget;
  scanning: boolean;
  scanDisabled: boolean;
  hasActiveKey: boolean;
  onResearch: (id: string) => void;
  onToggle: (target: ScraperTarget) => void;
  onScrape: (id: string) => void;
  onDelete: (target: ScraperTarget) => void;
}

function TargetCard({
  target: t,
  scanning,
  scanDisabled,
  hasActiveKey,
  onResearch,
  onToggle,
  onScrape,
  onDelete,
}: TargetCardProps) {
  return (
    <Card
      sx={{
        display: 'flex',
        flexDirection: 'column',
        opacity: t.is_active ? 1 : 0.55,
        transition: 'opacity 0.2s',
      }}
    >
      {t.research_status === 'pending' && <LinearProgress sx={{ height: 2 }} />}
      <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.5 }}>
          <Avatar
            sx={{
              width: 40,
              height: 40,
              fontWeight: 700,
              bgcolor: 'rgba(13, 148, 136, 0.12)',
              color: 'primary.dark',
            }}
          >
            {t.company_name.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {t.company_name}
            </Typography>
            {t.industry && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t.industry}
              </Typography>
            )}
          </Box>
          {t.research_status === 'pending' && (
            <Chip
              label="Researching…"
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                bgcolor: 'rgba(13, 148, 136, 0.12)',
                color: 'primary.dark',
              }}
            />
          )}
          {t.research_status === 'failed' && (
            <Tooltip title="Research failed — click to retry">
              <Chip
                label="Retry research"
                size="small"
                color="warning"
                variant="outlined"
                onClick={() => onResearch(t.id)}
                sx={{ height: 20, fontSize: '0.65rem' }}
              />
            </Tooltip>
          )}
        </Stack>

        {t.description ? (
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontSize: '0.82rem',
              mb: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {t.description}
          </Typography>
        ) : t.research_status === 'pending' ? (
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', fontSize: '0.82rem', mb: 1.5, fontStyle: 'italic' }}
          >
            Reading their website and hunting for the careers page…
          </Typography>
        ) : null}

        {(t.headquarters || t.company_size) && (
          <Stack direction="row" spacing={2} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
            {t.headquarters && (
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                <PlaceIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {t.headquarters}
                </Typography>
              </Stack>
            )}
            {t.company_size && (
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                <GroupsIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {t.company_size}
                </Typography>
              </Stack>
            )}
          </Stack>
        )}

        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
          {t.website && (
            <Chip
              icon={<LanguageIcon sx={{ fontSize: 13 }} />}
              label="Website"
              size="small"
              component="a"
              href={t.website}
              target="_blank"
              clickable
              sx={{ height: 24, fontSize: '0.7rem' }}
            />
          )}
          {t.career_url && (
            <Chip
              icon={<WorkOutlineIcon sx={{ fontSize: 13 }} />}
              label="Careers"
              size="small"
              component="a"
              href={t.career_url}
              target="_blank"
              clickable
              color="primary"
              variant="outlined"
              sx={{ height: 24, fontSize: '0.7rem' }}
            />
          )}
          {t.jobs_url && t.jobs_url !== t.career_url && (
            <Chip
              icon={<BusinessIcon sx={{ fontSize: 13 }} />}
              label="Open roles"
              size="small"
              component="a"
              href={t.jobs_url}
              target="_blank"
              clickable
              color="secondary"
              variant="outlined"
              sx={{ height: 24, fontSize: '0.7rem' }}
            />
          )}
        </Stack>

        {t.keywords.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {t.keywords.map((kw) => (
              <Chip key={kw} label={kw} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
            ))}
          </Box>
        )}

        <Stack
          direction="row"
          sx={{
            mt: 'auto',
            pt: 1,
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Tooltip title={t.is_active ? 'Monitoring active' : 'Monitoring paused'}>
            <Switch checked={t.is_active} onChange={() => onToggle(t)} size="small" />
          </Tooltip>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title={t.career_url ? 'Scan careers page now' : 'No careers URL yet'}>
              <span>
                <IconButton
                  size="small"
                  color="secondary"
                  onClick={() => onScrape(t.id)}
                  disabled={scanDisabled || !t.career_url}
                >
                  {scanning ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip
              title={!hasActiveKey ? 'Add an API key in Settings to use AI features.' : 'Re-run AI research'}
            >
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => onResearch(t.id)}
                  disabled={t.research_status === 'pending' || !hasActiveKey}
                >
                  <AutoAwesomeIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton size="small" color="error" onClick={() => onDelete(t)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
        {t.last_scraped && (
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.75, fontSize: '0.65rem' }}>
            Last scanned {new Date(t.last_scraped).toLocaleString()}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default React.memo(TargetCard);
