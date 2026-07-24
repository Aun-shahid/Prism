'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { m } from 'motion/react';
import ThemeToggle from '../components/ui/ThemeToggle';
import HoverCard from '../components/ui/HoverCard';
import GlassPanel from '../components/ui/GlassPanel';

const FEATURES = [
  {
    icon: <AutoAwesomeIcon />,
    title: 'AI Career Assistant',
    description:
      'An assistant that knows your experience, researches companies live, and drafts tailored emails and cover letters. Bring your own API key — no subscription.',
  },
  {
    icon: <ViewKanbanIcon />,
    title: 'Pipeline Tracking',
    description:
      'A kanban board for every application — from wishlist to offer. Statuses, salaries, contacts, notes and job descriptions in one place.',
  },
  {
    icon: <TravelExploreIcon />,
    title: 'Company Watchlist',
    description:
      'Name a company and AI finds its careers page, researches it, and monitors it for roles matching your target titles.',
  },
  {
    icon: <DescriptionIcon />,
    title: 'Resume Builder',
    description:
      'Versioned resumes with AI tailoring per job description, live preview, and one-click PDF or Word export.',
  },
];

export default function LandingPage() {
  const router = useRouter();

  return (
    <Box sx={{ minHeight: '100vh' }}>
      {/* Nav */}
      <AppBar position="static" elevation={0} sx={{ background: 'transparent', color: 'text.primary' }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Image src="/prism_logo.png" alt="Prism" width={34} height={34} style={{ objectFit: 'contain' }} />
              <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
                Prism
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <ThemeToggle />
              <Button color="inherit" onClick={() => router.push('/login')}>
                Sign In
              </Button>
              <Button variant="contained" onClick={() => router.push('/register')}>
                Get Started
              </Button>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Hero */}
      <Container maxWidth="lg">
        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <Stack spacing={3} sx={{ alignItems: 'center', textAlign: 'center', pt: { xs: 8, md: 12 }, pb: 6 }}>
            <Chip
              label="Your job hunt, organized"
              sx={{
                bgcolor: 'rgba(13, 148, 136, 0.10)',
                color: 'primary.dark',
                fontWeight: 700,
              }}
            />
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2.5rem', sm: '3.25rem', md: '4rem' },
                maxWidth: 820,
                lineHeight: 1.1,
              }}
            >
              Track every application.{' '}
              <Box
                component="span"
                sx={{
                  background: 'linear-gradient(120deg, #0d9488, #042f2e)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Land the offer.
              </Box>
            </Typography>
            <Typography variant="h6" sx={{ color: 'text.secondary', maxWidth: 640, fontWeight: 400 }}>
              Prism is a personal job-application assistant: a pipeline tracker, an AI research
              copilot, a resume builder and a recruiter outreach desk — in one calm workspace.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1 }}>
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForwardIcon />}
                onClick={() => router.push('/register')}
                sx={{ px: 4, py: 1.5 }}
              >
                Start for free
              </Button>
              <Button variant="outlined" size="large" onClick={() => router.push('/login')} sx={{ px: 4, py: 1.5 }}>
                Sign In
              </Button>
            </Stack>
          </Stack>
        </m.div>

        {/* Abstract product preview */}
        <m.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
        >
          <GlassPanel sx={{ borderRadius: 5, p: { xs: 2, md: 3 }, mb: 10, maxWidth: 900, mx: 'auto' }}>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              {['#e11d48', '#f59e0b', '#059669'].map((c) => (
                <Box key={c} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c, opacity: 0.6 }} />
              ))}
            </Stack>
            <Grid container spacing={2}>
              {[
                { label: 'Applications', value: '32' },
                { label: 'Interviewing', value: '5' },
                { label: 'Offers', value: '2' },
              ].map((stat) => (
                <Grid key={stat.label} size={{ xs: 4 }}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      {stat.label}
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {stat.value}
                    </Typography>
                  </Box>
                </Grid>
              ))}
              <Grid size={{ xs: 12 }}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 1,
                    height: 120,
                  }}
                >
                  {[28, 42, 34, 56, 48, 70, 62, 84, 76, 92, 88, 100].map((h, i) => (
                    <Box
                      key={i}
                      sx={{
                        flex: 1,
                        height: `${h}%`,
                        borderRadius: 1,
                        bgcolor: 'primary.main',
                        opacity: 0.25 + (i / 12) * 0.6,
                      }}
                    />
                  ))}
                </Box>
              </Grid>
            </Grid>
          </GlassPanel>
        </m.div>

        {/* Features */}
        <Typography variant="h3" sx={{ textAlign: 'center', mb: 1 }}>
          Everything between &ldquo;applied&rdquo; and &ldquo;hired&rdquo;
        </Typography>
        <Typography variant="body1" sx={{ textAlign: 'center', color: 'text.secondary', mb: 5 }}>
          Four tools that work off the same profile, so nothing is typed twice.
        </Typography>
        <Grid container spacing={2.5} sx={{ mb: 12 }}>
          {FEATURES.map((feature) => (
            <Grid key={feature.title} size={{ xs: 12, sm: 6, md: 3 }}>
              <HoverCard sx={{ p: 3, height: '100%' }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'rgba(13, 148, 136, 0.10)',
                    color: 'primary.main',
                    mb: 2,
                  }}
                >
                  {feature.icon}
                </Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {feature.title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {feature.description}
                </Typography>
              </HoverCard>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Footer */}
      <Divider />
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ py: 4, alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Image src="/prism_logo.png" alt="Prism" width={22} height={22} style={{ objectFit: 'contain' }} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Prism — Job Application Assistant
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Bring your own AI key. Your data stays yours.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
