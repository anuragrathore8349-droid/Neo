import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, ArrowRight } from 'lucide-react';
import AuthLayout from '../../../components/common/AuthLayout';
import Button from '../../../components/common/Button/Button';
import { useAuth } from '../../../context/AuthContext';

const twoFactorSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
});

type TwoFactorFormData = z.infer<typeof twoFactorSchema>;

interface LocationState {
  email?: string;
  password?: string;
}

const TwoFactorAuth: React.FC = () => {
  const { login, isLoading, error, setError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { email, password } = (location.state as LocationState) || {};
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));

  const {
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<TwoFactorFormData>({
    resolver: zodResolver(twoFactorSchema),
    defaultValues: {
      code: '',
    },
  });

  React.useEffect(() => {
    // Clear any existing errors when component mounts
    setError(null);

    // This page only makes sense as a continuation of the login flow.
    // If someone lands here directly (e.g. page refresh), send them back
    // to login since we no longer have their credentials.
    if (!email || !password) {
      navigate('/login', { replace: true });
    }
  }, [setError, email, password, navigate]);

  const handleDigitChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }
    
    if (!/^\d*$/.test(value) && value !== '') {
      return;
    }
    
    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);
    
    // Update form value
    setValue('code', newDigits.join(''));
    
    // Auto-focus next input
    if (value !== '' && index < 5) {
      const nextInput = document.getElementById(`digit-${index + 1}`);
      if (nextInput) {
        nextInput.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace') {
      if (digits[index] === '' && index > 0) {
        const prevInput = document.getElementById(`digit-${index - 1}`);
        if (prevInput) {
          prevInput.focus();
        }
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    
    // Check if pasted data is a 6-digit number
    if (/^\d{6}$/.test(pastedData)) {
      const newDigits = pastedData.split('');
      setDigits(newDigits);
      setValue('code', pastedData);
    }
  };

  const onSubmit = async (data: TwoFactorFormData) => {
    if (!email || !password) {
      navigate('/login');
      return;
    }
    try {
      // Complete the login now that we have the 2FA code too.
      await login(email, password, data.code);
      navigate('/dashboard');
    } catch (err) {
      // Error is handled in the auth context (e.g. "Invalid 2FA code")
    }
  };

  return (
    <AuthLayout
      title="Two-Factor Authentication"
      subtitle="Enter the 6-digit code from your authenticator app"
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        {error && (
          <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
            {error}
          </div>
        )}
        
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <Shield size={32} className="text-primary" />
          </div>
        </div>
        
        <div className="mb-6">
          <label className="form-label">Authentication Code</label>
          <div className="flex justify-between gap-2 mt-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <input
                key={index}
                id={`digit-${index}`}
                type="text"
                maxLength={1}
                className="input-field w-12 h-12 text-center text-xl"
                value={digits[index]}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                autoFocus={index === 0}
              />
            ))}
          </div>
          {errors.code && <p className="form-error mt-2">{errors.code.message}</p>}
        </div>
        
        <div className="mb-6">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={isLoading}
            rightIcon={<ArrowRight size={18} />}
            disabled={digits.join('').length !== 6}
          >
            Verify
          </Button>
        </div>
        
        <p className="text-center text-dark-300 text-sm">
          Didn't receive a code? Check your authenticator app or contact support.
        </p>
      </form>
    </AuthLayout>
  );
};

export default TwoFactorAuth;
