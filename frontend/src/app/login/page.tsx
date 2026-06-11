'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  Link,
  CircularProgress
} from '@mui/material';

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = React.useState({
    usernameOrEmail: '',
    password: ''
  });
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState<boolean>(false);

  React.useEffect(() => {
    // Redirect if already logged in
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.usernameOrEmail || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      await login({
        username_or_email: formData.usernameOrEmail,
        password: formData.password
      });
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        'Failed to log in. Please check your credentials.'
      );
      setSubmitting(false);
    }
  };

  if (loading && !submitting) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'radial-gradient(circle at center, #111827 0%, #030712 100%)',
        p: 2
      }}
    >
      <Container maxWidth="xs">
        <Card sx={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)', bgcolor: 'rgba(17, 24, 39, 0.7)', backdropFilter: 'blur(10px)' }}>
          <CardContent sx={{ p: 4 }}>
            <Stack spacing={3} sx={{ alignItems: 'center' }}>
              <Box 
                sx={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: 1, 
                  background: 'linear-gradient(135deg, #7c3aed 0%, #10b981 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  color: '#fff',
                  fontSize: '1.25rem'
                }}
              >
                P
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 800, textAlign: 'center' }}>
                Sign In to Prism
              </Typography>
            </Stack>

            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 4 }}>
              <Stack spacing={3}>
                {error && <Alert severity="error">{error}</Alert>}
                
                <TextField
                  label="Username or Email"
                  name="usernameOrEmail"
                  value={formData.usernameOrEmail}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  required
                />
                
                <TextField
                  label="Password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  required
                />

                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="large"
                  disabled={submitting}
                  sx={{ 
                    mt: 1,
                    py: 1.5,
                    background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
                    boxShadow: '0 4px 12px 0 rgba(124, 58, 237, 0.3)'
                  }}
                >
                  {submitting ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
                </Button>
              </Stack>
            </Box>

            <Typography variant="body2" sx={{ mt: 3, textAlign: 'center', color: 'text.secondary' }}>
              Don&apos;t have an account?{' '}
              <Link href="/register" underline="hover" sx={{ color: 'primary.main', fontWeight: 600 }}>
                Sign Up
              </Link>
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
