import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import AuthLayout from '../../../components/common/AuthLayout';
import Input from '../../../components/common/Input/Input';
import Button from '../../../components/common/Button/Button';
import { useAuth } from '../../../context/AuthContext';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

const ForgotPassword: React.FC = () => {
  const { forgotPassword, isLoading, error, setError } = useAuth();
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const watchedEmail = watch('email');

  React.useEffect(() => {
    // Clear any existing errors when component mounts
    setError(null);
  }, [setError]);

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      await forgotPassword(data.email);
      setIsSubmitted(true);
    } catch (err) {
      // Error is handled in the auth context
    }
  };

  if (isSubmitted) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="We've sent a password reset link to your email"
      >
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle size={32} className="text-success" />
            </div>
          </div>
          
          <p className="text-dark-300 mb-6">
            We've sent a password reset link to <span className="text-white font-medium">{watchedEmail}</span>. 
            Please check your inbox and follow the instructions to reset your password.
          </p>
          
          <p className="text-dark-400 text-sm mb-8">
            If you don't see the email, check your spam folder or try another email address.
          </p>
          
          <Button
            variant="outline"
            onClick={() => setIsSubmitted(false)}
            leftIcon={<ArrowLeft size={18} />}
          >
            Try another email
          </Button>
          
          <p className="text-center text-dark-300 mt-6">
            Remember your password?{' '}
            <Link to="/login" className="text-primary hover:text-primary-light">
              Sign in
            </Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="Enter your email and we'll send you a reset link"
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        {error && (
          <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
            {error}
          </div>
        )}
        
        <Input
          label="Email"
          type="email"
          placeholder="Enter your email"
          leftIcon={<Mail size={18} />}
          error={errors.email?.message}
          {...register('email')}
        />
        
        <div className="mt-6 mb-6">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={isLoading}
          >
            Send Reset Link
          </Button>
        </div>
        
        <p className="text-center">
          <Link to="/login" className="text-primary hover:text-primary-light flex items-center justify-center">
            <ArrowLeft size={16} className="mr-2" />
            Back to login
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default ForgotPassword;

