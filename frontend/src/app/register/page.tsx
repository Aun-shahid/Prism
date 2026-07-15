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

export default function RegisterPage() {
  const { user, register, loading } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = React.useState({
    name: '',
    username: '',
    email: '',
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

    if (!formData.name || !formData.username || !formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        name: formData.name,
        username: formData.username,
        email: formData.email,
        password: formData.password
      });
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        'Failed to sign up. Username or email might already be taken.'
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
                component="img"
                src="/prism_logo.png"
                alt="Prism"
                sx={{ width: 56, height: 56, objectFit: 'contain', display: 'block' }}
              />
              <Typography variant="h5" sx={{ fontWeight: 800, textAlign: 'center' }}>
                Join Prism
              </Typography>
            </Stack>

            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 4 }}>
              <Stack spacing={2.5}>
                {error && <Alert severity="error">{error}</Alert>}
                
                <TextField
                  label="Full Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  required
                />

                <TextField
                  label="Username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  required
                />
                
                <TextField
                  label="Email Address"
                  name="email"
                  type="email"
                  value={formData.email}
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
                    mt: 1.5,
                    py: 1.5,
                    background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
                    boxShadow: '0 4px 12px 0 rgba(124, 58, 237, 0.3)'
                  }}
                >
                  {submitting ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
                </Button>
              </Stack>
            </Box>

            <Typography variant="body2" sx={{ mt: 3, textAlign: 'center', color: 'text.secondary' }}>
              Already have an account?{' '}
              <Link href="/login" underline="hover" sx={{ color: 'primary.main', fontWeight: 600 }}>
                Sign In
              </Link>
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
