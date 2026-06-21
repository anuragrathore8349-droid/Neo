import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import AuthLayout from '../../../components/common/AuthLayout';
import Input from '../../../components/common/Input/Input';
import Button from '../../../components/common/Button/Button';
import { useAuth } from '../../../context/AuthContext';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
  terms: z.boolean().refine(val => val === true, {
    message: 'You must agree to the terms and conditions',
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

const Register: React.FC = () => {
  const { register: registerUser, isLoading, error, setError } = useAuth();
  const navigate = useNavigate();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      terms: false,
    },
  });

  React.useEffect(() => {
    // Clear any existing errors when component mounts
    setError(null);
  }, [setError]);

  const onSubmit = async (data: RegisterFormData) => {
    console.log('Register form submit - validation passed', data);
    try {
      await registerUser(data.email, data.password, data.name);
      console.log('Register API call succeeded');
      navigate('/verify-email', { state: { email: data.email } });
    } catch (err) {
      console.error('Register API call failed', err);
      // Error is handled in the auth context
    }
  };

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Join NeoFin to start your financial journey"
    >
      <form onSubmit={(e) => { console.log('Form submit event triggered'); handleSubmit(onSubmit)(e); }}>
        {error && (
          <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
            {error}
          </div>
        )}
        
        <Input
          label="Full Name"
          placeholder="Enter your full name"
          leftIcon={<User size={18} />}
          error={errors.name?.message}
          {...register('name')}
        />
        
        <Input
          label="Email"
          type="email"
          placeholder="Enter your email"
          leftIcon={<Mail size={18} />}
          error={errors.email?.message}
          {...register('email')}
        />
        
        <Input
          label="Password"
          type="password"
          placeholder="Create a password"
          leftIcon={<Lock size={18} />}
          showPasswordToggle
          error={errors.password?.message}
          {...register('password')}
        />
        
        <Input
          label="Confirm Password"
          type="password"
          placeholder="Confirm your password"
          leftIcon={<Lock size={18} />}
          showPasswordToggle
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        
        <div className="mb-6">
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="terms"
                type="checkbox"
                className="h-4 w-4 rounded border-dark-600 bg-dark-800 text-primary focus:ring-primary/50"
                {...register('terms')}
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="terms" className="text-dark-300">
                I agree to the{' '}
                <a href="#" className="text-primary hover:text-primary-light">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#" className="text-primary hover:text-primary-light">
                  Privacy Policy
                </a>
              </label>
              {errors.terms && <p className="form-error">{errors.terms.message}</p>}
            </div>
          </div>
        </div>
        
        <Button
          type="submit"
          variant="primary"
          fullWidth
          isLoading={isLoading}
          rightIcon={<ArrowRight size={18} />}
          onClick={() => console.log('CREATE ACCOUNT BUTTON CLICKED')}
        >
          Create Account
        </Button>
        
        <div className="auth-divider">
          <span className="auth-divider-text">OR</span>
        </div>
        
        <p className="text-center text-dark-300 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:text-primary-light">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Register;
