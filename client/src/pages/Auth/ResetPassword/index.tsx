import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, ArrowRight } from 'lucide-react';
import AuthLayout from '../../../components/common/AuthLayout';
import Input from '../../../components/common/Input/Input';
import Button from '../../../components/common/Button/Button';
import { useAuth } from '../../../context/AuthContext';

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

const ResetPassword: React.FC = () => {
  const { resetPassword, isLoading, error, setError } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  React.useEffect(() => {
    // Clear any existing errors when component mounts
    setError(null);
    
    // Validate token
    if (!token) {
      setError('Invalid or expired password reset link');
    }
  }, [setError, token]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) return;
    
    try {
      await resetPassword(token, data.password);
      navigate('/login', { state: { message: 'Your password has been reset successfully. You can now log in with your new password.' } });
    } catch (err) {
      // Error is handled in the auth context
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Create a new password for your account"
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        {error && (
          <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
            {error}
          </div>
        )}
        
        <Input
          label="New Password"
          type="password"
          placeholder="Create a new password"
          leftIcon={<Lock size={18} />}
          showPasswordToggle
          error={errors.password?.message}
          {...register('password')}
        />
        
        <Input
          label="Confirm Password"
          type="password"
          placeholder="Confirm your new password"
          leftIcon={<Lock size={18} />}
          showPasswordToggle
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        
        <div className="mt-6 mb-6">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={isLoading}
            rightIcon={<ArrowRight size={18} />}
            disabled={!token}
          >
            Reset Password
          </Button>
        </div>
        
        <p className="text-center text-dark-300">
          Remember your password?{' '}
          <Link to="/login" className="text-primary hover:text-primary-light">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default ResetPassword;