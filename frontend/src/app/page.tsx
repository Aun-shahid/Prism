'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Box, 
  Container, 
  Typography, 
  Button, 
  Grid, 
  Card, 
  CardContent, 
  AppBar, 
  Toolbar, 
  Stack, 
  useTheme 
} from '@mui/material';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import SecurityIcon from '@mui/icons-material/Security';

export default function LandingPage() {
  const router = useRouter();
  const theme = useTheme();

  const features = [
    {
      icon: <TrackChangesIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: 'Application Funnel',
      description: 'Track your jobs from wishlist, applied, interviewing, through to receiving offers with a visual pipeline.',
    },
    {
      icon: <AutoAwesomeIcon sx={{ fontSize: 40, color: theme.palette.secondary.main }} />,
      title: 'AI Smart Insights',
      description: 'Manage details of each job description, requirements, and align your applications for maximum response.',
    },
    {
      icon: <DashboardCustomizeIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: 'Metrics & Statistics',
      description: 'Observe conversion rates between resumes sent, interview calls, and offers to optimize your search.',
    },
    {
      icon: <SecurityIcon sx={{ fontSize: 40, color: theme.palette.secondary.main }} />,
      title: 'Secure & Private',
      description: 'Your applications, contact info, and notes are securely stored on your own personal dashboard.',
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header AppBar */}
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Container maxWidth="lg">
          <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 0, sm: 2 } }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Box
                component="img"
                src="/prism_logo.png"
                alt="Prism"
                sx={{ width: 34, height: 34, objectFit: 'contain', display: 'block' }}
              />
              <Typography variant="h6" component="div" sx={{ fontWeight: 800, trackingWidth: -0.5 }}>
                Prism
              </Typography>
            </Stack>

            <Stack direction="row" spacing={2}>
              <Button color="inherit" onClick={() => router.push('/login')}>
                Sign In
              </Button>
              <Button 
                variant="contained" 
                color="primary"
                onClick={() => router.push('/register')}
                sx={{ 
                  background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
                  boxShadow: '0 4px 14px 0 rgba(124, 58, 237, 0.4)'
                }}
              >
                Get Started
              </Button>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Hero Section */}
      <Container maxWidth="lg" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', py: { xs: 8, md: 12 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '7fr 5fr' }, gap: 6, alignItems: 'center', width: '100%' }}>
          <Box>
            <Box
              component="img"
              src="/logo.png"
              alt="Prism"
              sx={{
                width: { xs: 260, md: 400 },
                height: 'auto',
                display: 'block',
                mb: 1,
                ml: { xs: -2, md: -3 },
                filter: 'drop-shadow(0 8px 40px rgba(124, 58, 237, 0.25))',
              }}
            />
            <Typography
              component="span"
              variant="subtitle1"
              sx={{
                color: 'secondary.main',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                mb: 2,
                display: 'inline-block'
              }}
            >
              Your Personal Career Copilot
            </Typography>
            <Typography 
              variant="h1" 
              sx={{ 
                fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' }, 
                fontWeight: 800, 
                lineHeight: 1.1,
                mb: 3,
                background: 'linear-gradient(to right, #ffffff, #a78bfa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Organize Your Job Search Effortlessly
            </Typography>
            <Typography variant="h5" sx={{ color: 'text.secondary', fontWeight: 400, mb: 4, lineHeight: 1.6, pr: { md: 4 } }}>
              Prism is a premium personal assistant designed to help you track job applications, optimize your funnel, and secure your next role.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button 
                variant="contained" 
                size="large" 
                color="primary"
                onClick={() => router.push('/register')}
                sx={{ 
                  px: 4, 
                  py: 1.5,
                  fontSize: '1.1rem',
                  background: 'linear-gradient(135deg, #7c3aed 0%, #10b981 100%)',
                  boxShadow: '0 6px 20px 0 rgba(124, 58, 237, 0.3)'
                }}
              >
                Create Free Account
              </Button>
              <Button 
                variant="outlined" 
                size="large" 
                onClick={() => router.push('/login')}
                sx={{ px: 4, py: 1.5, fontSize: '1.1rem', borderColor: 'rgba(255,255,255,0.2)' }}
              >
                Sign In
              </Button>
            </Stack>
          </Box>

          {/* Hero Decorative Visual */}
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <Box 
              sx={{ 
                position: 'relative',
                width: '100%',
                height: 400,
                borderRadius: 4,
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
              }}
            >
              {/* Abstract Visual representation of dashboard */}
              <Box sx={{ width: '80%', height: '70%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ width: 100, height: 12, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 1 }} />
                  <Box sx={{ width: 50, height: 12, bgcolor: 'primary.main', borderRadius: 1, opacity: 0.8 }} />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                  {[1, 2, 3].map((item) => (
                    <Box key={item} sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ width: '60%', height: 8, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 1 }} />
                      <Box sx={{ width: '80%', height: 16, bgcolor: 'primary.main', borderRadius: 1, opacity: 0.5 + item*0.1 }} />
                    </Box>
                  ))}
                </Box>
                <Box sx={{ flexGrow: 1, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ width: '30%', height: 10, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 1 }} />
                  {[1, 2].map((i) => (
                    <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: i === 1 ? 'secondary.main' : 'primary.main' }} />
                        <Box sx={{ width: 120, height: 8, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 1 }} />
                      </Stack>
                      <Box sx={{ width: 60, height: 12, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }} />
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Container>

      {/* Feature Grid Section */}
      <Box sx={{ bgcolor: 'rgba(255, 255, 255, 0.01)', borderTop: '1px solid rgba(255,255,255,0.04)', py: 10 }}>
        <Container maxWidth="lg">
          <Typography variant="h2" sx={{ textAlign: 'center', fontSize: '2.25rem', fontWeight: 800, mb: 8 }}>
            Core Capabilities Built For You
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 4 }}>
            {features.map((feature, index) => (
              <Card key={index} sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { transform: 'translateY(-5px)', transition: 'all 0.3s ease' } }}>
                <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>{feature.icon}</Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', py: 4, mt: 'auto' }}>
        <Container maxWidth="lg">
          <Typography variant="body2" align="center" sx={{ color: 'text.secondary' }}>
            &copy; {new Date().getFullYear()} Prism. Built for job seekers. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
