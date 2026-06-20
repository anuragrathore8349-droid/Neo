import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { Mail, CheckCircle, ArrowRight } from 'lucide-react';
import { toast } from 'react-toastify';
import AuthLayout from '../../../components/common/AuthLayout';
import Button from '../../../components/common/Button/Button';
import { useAuth } from '../../../context/AuthContext';
import * as authService from '../../../services/auth.service';

const VerifyEmail: React.FC = () => {
  const { verifyEmail, isLoading, error, setError, user } = useAuth();
  const [searchParams] = useSearchParams();
  const { token: tokenParam } = useParams();
  const navigate = useNavigate();
  const token = tokenParam || searchParams.get('token');
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending');

  useEffect(() => {
    // Clear any existing errors when component mounts
    setError(null);
    
    // If there's a token, verify it
    if (token) {
      const verify = async () => {
        try {
          await verifyEmail(token);
          setVerificationStatus('success');
        } catch (err) {
          setVerificationStatus('error');
        }
      };
      
      verify();
    }
  }, [token, verifyEmail, setError]);

  // If user is already verified, redirect to plan selection
  useEffect(() => {
    if (user && verificationStatus === 'success') {
      const timer = setTimeout(() => {
        navigate('/select-plan');
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [user, verificationStatus, navigate]);

  if (token) {
    return (
      <AuthLayout
        title={
          verificationStatus === 'success'
            ? 'Email Verified!'
            : verificationStatus === 'error'
            ? 'Verification Failed'
            : 'Verifying Email...'
        }
        subtitle={
          verificationStatus === 'success'
            ? 'Your email has been successfully verified'
            : verificationStatus === 'error'
            ? 'We could not verify your email'
            : 'Please wait while we verify your email'
        }
      >
        <div className="text-center">
          <div className="flex justify-center mb-6">
            {verificationStatus === 'pending' && (
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            
            {verificationStatus === 'success' && (
              <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle size={32} className="text-success" />
              </div>
            )}
            
            {verificationStatus === 'error' && (
              <div className="w-16 h-16 rounded-full bg-error/20 flex items-center justify-center">
                <Mail size={32} className="text-error" />
              </div>
            )}
          </div>
          
          {verificationStatus === 'success' && (
            <>
              <p className="text-dark-300 mb-6">
                Your email has been verified successfully. Let's choose a plan to get started!
              </p>
              
              <Button
                variant="primary"
                onClick={() => navigate('/select-plan')}
                rightIcon={<ArrowRight size={18} />}
              >
                Choose Your Plan
              </Button>
            </>
          )}
          
          {verificationStatus === 'error' && (
            <>
              <p className="text-dark-300 mb-6">
                {error || 'The verification link is invalid or has expired. Please request a new verification link.'}
              </p>
              
              <Button
                variant="primary"
                onClick={() => navigate('/login')}
              >
                Back to Login
              </Button>
            </>
          )}
          
          {verificationStatus === 'pending' && (
            <p className="text-dark-300">
              Please wait while we verify your email address...
            </p>
          )}
        </div>
      </AuthLayout>
    );
  }

  // Default view - waiting for verification
  return (
    <AuthLayout
      title="Verify your email"
      subtitle="We've sent a verification link to your email"
    >
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <Mail size={32} className="text-primary" />
          </div>
        </div>
        
        <p className="text-dark-300 mb-6">
          We've sent a verification link to <span className="text-white font-medium">{user?.email || 'your email'}</span>. 
          Please check your inbox and click the link to verify your account.
        </p>
        
        <p className="text-dark-400 text-sm mb-8">
          If you don't see the email, check your spam folder or try another email address.
        </p>
        
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await authService.forgotPassword(user?.email || '');
              toast.success('Verification email sent!');
            } catch {
              toast.error('Failed to send email');
            }
          }}
          isLoading={isLoading}
        >
          Resend Verification Email
        </Button>
        
        <p className="text-center text-dark-300 mt-6">
          Already verified?{' '}
          <Link to="/login" className="text-primary hover:text-primary-light">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default VerifyEmail;