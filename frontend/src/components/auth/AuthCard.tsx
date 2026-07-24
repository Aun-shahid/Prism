'use client';

import * as React from 'react';
import Image from 'next/image';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import GlassPanel from '../ui/GlassPanel';
import ThemeToggle from '../ui/ThemeToggle';

interface AuthCardProps {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Centered frosted-glass card over the teal mesh — shared by login/register. */
export default function AuthCard({ title, children, footer }: AuthCardProps) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        position: 'relative',
      }}
    >
      <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
        <ThemeToggle />
      </Box>
      <Container maxWidth="xs">
        <GlassPanel sx={{ borderRadius: 4 }}>
          <Box sx={{ p: 4 }}>
            <Stack spacing={2.5} sx={{ alignItems: 'center', mb: 4 }}>
              <Image
                src="/prism_logo.png"
                alt="Prism"
                width={56}
                height={56}
                style={{ objectFit: 'contain' }}
              />
              <Typography variant="h5" sx={{ textAlign: 'center' }}>
                {title}
              </Typography>
            </Stack>
            {children}
            {footer && (
              <Typography variant="body2" sx={{ mt: 3, textAlign: 'center', color: 'text.secondary' }}>
                {footer}
              </Typography>
            )}
          </Box>
        </GlassPanel>
      </Container>
    </Box>
  );
}
