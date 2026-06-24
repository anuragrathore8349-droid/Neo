import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, ArrowRight } from 'lucide-react';
import AuthLayout from '../../../components/common/AuthLayout';
import Button from '../../../components/common/Button/Button';
import { usePlan } from '../../../context/PlanContext';
import { useUser } from '../../../context/UserContext';
import { toast } from 'react-toastify';

const SubscriptionSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshSubscription, currentPlan } = usePlan();
  const { updateUser } = useUser();
  const sessionId = searchParams.get('session_id');

  // Handle subscription success
  useEffect(() => {
    const handleSuccess = async () => {
      try {
        // Refresh subscription data
        await refreshSubscription();
        toast.success('Subscription activated successfully!');
      } catch (error) {
        console.error('Failed to refresh subscription:', error);
      }
    };

    if (sessionId) {
      handleSuccess();
    }
  }, [sessionId, refreshSubscription]);

  // Update user plan once subscription is refreshed
  useEffect(() => {
    if (currentPlan?.name) {
      updateUser({ plan: currentPlan.name });
    }
  }, [currentPlan?.name, updateUser]);

  return (
    <AuthLayout
      title="Subscription Activated!"
      subtitle="Welcome to your premium experience"
    >
      <div className="text-center max-w-lg">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
            <CheckCircle size={32} className="text-success" />
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            Thank you for upgrading!
          </h2>
          <p className="text-dark-300 mb-4">
            Your subscription is now active and you have access to all premium features.
          </p>
          <div className="bg-dark-800 border border-dark-700 rounded-lg p-4 text-left">
            <h3 className="text-white font-semibold mb-3">What's included:</h3>
            <ul className="space-y-2 text-dark-200 text-sm">
              <li>✓ Advanced analytics and insights</li>
              <li>✓ Real-time market data</li>
              <li>✓ AI-powered predictions</li>
              <li>✓ Priority support</li>
              <li>✓ Unlimited transactions</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            onClick={() => navigate('/dashboard')}
            rightIcon={<ArrowRight size={18} />}
          >
            Go to Dashboard
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/settings')}
          >
            View Subscription Settings
          </Button>
        </div>

        <p className="text-dark-400 text-sm mt-6">
          You can manage your subscription and billing at any time from your account settings.
        </p>
      </div>
    </AuthLayout>
  );
};

export default SubscriptionSuccess;
