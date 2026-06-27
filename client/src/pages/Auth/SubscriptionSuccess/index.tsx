// client/src/pages/Auth/SubscriptionSuccess/index.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, ArrowRight, Loader } from 'lucide-react';
import AuthLayout from '../../../components/common/AuthLayout';
import Button from '../../../components/common/Button/Button';
import { usePlan } from '../../../context/PlanContext';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'react-toastify';
import * as authService from '../../../services/auth.service';

const SubscriptionSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshSubscription, currentPlan } = usePlan();
  const { updateUserPlan } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const handleSuccess = async () => {
      try {
        setIsProcessing(true);

        // Step 1: Refresh subscription data from DB
        await refreshSubscription();

        // Step 2: ✅ FIX — Refresh JWT token so it embeds the new plan.
        // Without this, all subsequent API calls carry the old 'basic' plan
        // in the JWT and gated endpoints keep returning 403.
        try {
          const result = await authService.refreshToken();
          if (result?.data?.accessToken) {
            // Write new token to localStorage (AuthContext reads from there)
            const stored = JSON.parse(localStorage.getItem('neofin_auth') || '{}');
            stored.accessToken = result.data.accessToken;
            if (result.data.refreshToken) stored.refreshToken = result.data.refreshToken;
            localStorage.setItem('neofin_auth', JSON.stringify(stored));
          }
        } catch (tokenErr) {
          // Non-fatal — user may need to re-login to pick up new plan in JWT
          console.warn('Could not refresh token:', tokenErr);
        }

        // Step 3: Refresh subscription one more time to sync PlanContext with new JWT
        await refreshSubscription();

        toast.success('🎉 Subscription activated! Welcome to your premium plan.');
      } catch (error) {
        console.error('Failed to activate subscription:', error);
        toast.error('Subscription activated but refresh failed. Please re-login to apply your new plan.');
      } finally {
        setIsProcessing(false);
      }
    };

    handleSuccess();
  }, [sessionId]);

  // Sync plan into AuthContext user object whenever PlanContext resolves it
  useEffect(() => {
    if (currentPlan?.id) {
      updateUserPlan(currentPlan.id);
    }
  }, [currentPlan?.id]);

  return (
    <AuthLayout
      title="Subscription Activated!"
      subtitle="Welcome to your premium experience"
    >
      <div className="text-center max-w-lg">
        {isProcessing ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader size={40} className="text-primary animate-spin" />
            <p className="text-dark-300">Activating your subscription...</p>
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle size={40} className="text-success" />
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">
                🎉 Thank you for upgrading!
              </h2>
              {currentPlan && (
                <p className="text-primary font-semibold text-lg mb-2">
                  You're now on the {currentPlan.name} Plan
                </p>
              )}
              <p className="text-dark-300 mb-6">
                Your subscription is active. All premium features are now unlocked.
                A confirmation email has been sent to you.
              </p>

              <div className="bg-dark-800 border border-dark-700 rounded-lg p-4 text-left">
                <h3 className="text-white font-semibold mb-3">✨ What you now have access to:</h3>
                {currentPlan?.id === 'enterprise' ? (
                  <ul className="space-y-2 text-dark-200 text-sm">
                    <li>✓ Everything in Pro, plus DeFi integration</li>
                    <li>✓ Custom API integrations & webhooks</li>
                    <li>✓ Unlimited portfolios, watchlists & alerts</li>
                    <li>✓ Unlimited API calls & data retention</li>
                    <li>✓ Dedicated account manager & priority support</li>
                  </ul>
                ) : (
                  <ul className="space-y-2 text-dark-200 text-sm">
                    <li>✓ Real-time market data & live price feeds</li>
                    <li>✓ AI-powered insights & predictions</li>
                    <li>✓ Advanced analytics & reports</li>
                    <li>✓ Unlimited transactions</li>
                    <li>✓ Up to 5 portfolios & 10 watchlists</li>
                  </ul>
                )}
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
              Check your email for a detailed confirmation of your subscription.
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
};

export default SubscriptionSuccess;
