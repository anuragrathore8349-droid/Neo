import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight } from 'lucide-react';
import AuthLayout from '../../../components/common/AuthLayout';
import Button from '../../../components/common/Button/Button';

const SubscriptionCancelled: React.FC = () => {
  const navigate = useNavigate();

  return (
    <AuthLayout
      title="Subscription Cancelled"
      subtitle="Your checkout was cancelled"
    >
      <div className="text-center max-w-lg">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center">
            <AlertCircle size={32} className="text-warning" />
          </div>
        </div>

        <div className="mb-8">
          <p className="text-dark-300 mb-4">
            Your subscription setup was interrupted. No charges have been made to your account.
          </p>
          <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
            <p className="text-dark-200 text-sm">
              This can happen if you closed the checkout page or encountered a payment error. 
              You can try again or choose a different plan.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            onClick={() => navigate('/select-plan')}
            rightIcon={<ArrowRight size={18} />}
          >
            Try Again
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/dashboard')}
          >
            Continue with Basic Plan
          </Button>
        </div>

        <p className="text-dark-400 text-sm mt-6">
          Need help?{' '}
          <a href="/support" className="text-primary hover:text-primary/80">
            Contact our support team
          </a>
        </p>
      </div>
    </AuthLayout>
  );
};

export default SubscriptionCancelled;
