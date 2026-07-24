'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import AuthCard from '../../components/auth/AuthCard';

export default function RegisterPage() {
  const { user, register, loading } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = React.useState({
    name: '',
    username: '',
    email: '',
    password: '',
  });
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
        password: formData.password,
      });
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || 'Failed to create your account. Please try again.');
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
    <AuthCard
      title="Create your Prism account"
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" underline="hover" sx={{ color: 'primary.main', fontWeight: 600 }}>
            Sign In
          </Link>
        </>
      }
    >
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={3}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField label="Full Name" name="name" value={formData.name} onChange={handleChange} fullWidth required />

          <TextField
            label="Username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            fullWidth
            required
          />

          <TextField
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            fullWidth
            required
          />

          <TextField
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            fullWidth
            required
          />

          <Button type="submit" variant="contained" size="large" disabled={submitting} sx={{ mt: 1, py: 1.5 }}>
            {submitting ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
          </Button>
        </Stack>
      </Box>
    </AuthCard>
  );
}
