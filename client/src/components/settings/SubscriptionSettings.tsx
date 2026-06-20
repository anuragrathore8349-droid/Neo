import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CreditCard, AlertCircle, CheckCircle, Zap } from 'lucide-react';
import { usePlan } from '../../../context/PlanContext';
import * as paymentService from '../../../services/payment.service';
import Button from '../../../components/common/Button/Button';
import { toast } from 'react-toastify';

interface BillingHistoryItem {
  id: string;
  amount: number;
  date: string;
  status: 'succeeded' | 'pending' | 'failed';
  invoiceUrl?: string;
}

const SubscriptionSettings: React.FC = () => {
  const navigate = useNavigate();
  const { 
    currentPlan, 
    userSubscription, 
    upgradeToPlans, 
    cancelSubscription,
    refreshSubscription 
  } = usePlan();

  const [billingHistory, setBillingHistory] = useState<BillingHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    loadBillingHistory();
  }, []);

  const loadBillingHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const history = await paymentService.getBillingHistory();
      setBillingHistory(history);
    } catch (error) {
      console.error('Failed to load billing history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleUpgradePlan = async (planId: string) => {
    try {
      await upgradeToPlans(planId);
    } catch (error) {
      toast.error('Failed to initiate upgrade');
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setIsCancelling(true);
      await cancelSubscription();
      setShowCancelConfirm(false);
      toast.success('Subscription cancelled successfully');
    } catch (error) {
      toast.error('Failed to cancel subscription');
    } finally {
      setIsCancelling(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <span className="px-3 py-1 bg-success/20 text-success rounded-full text-sm">Paid</span>;
      case 'pending':
        return <span className="px-3 py-1 bg-warning/20 text-warning rounded-full text-sm">Pending</span>;
      case 'failed':
        return <span className="px-3 py-1 bg-error/20 text-error rounded-full text-sm">Failed</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Subscription Section */}
      {currentPlan && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-dark-800 rounded-lg p-6 border border-dark-700"
        >
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">
                {currentPlan.name} Plan
              </h3>
              <p className="text-dark-300">
                {currentPlan.price === 0 
                  ? 'Free plan - upgrade anytime'
                  : `${currentPlan.price}${currentPlan.period}`}
              </p>
            </div>
            <div className="text-right">
              {userSubscription?.status === 'active' && (
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle size={20} />
                  <span className="font-semibold">Active</span>
                </div>
              )}
              {userSubscription?.status === 'cancelled' && (
                <div className="flex items-center gap-2 text-warning">
                  <AlertCircle size={20} />
                  <span className="font-semibold">Cancelled</span>
                </div>
              )}
            </div>
          </div>

          {/* Subscription Details */}
          {userSubscription?.currentPeriodEnd && (
            <div className="bg-dark-900 rounded p-4 mb-6 text-sm text-dark-300">
              <p className="mb-2">
                <span className="text-white">Next billing date:</span>{' '}
                {formatDate(userSubscription.currentPeriodEnd)}
              </p>
              {userSubscription.currentPeriodStart && (
                <p>
                  <span className="text-white">Current period started:</span>{' '}
                  {formatDate(userSubscription.currentPeriodStart)}
                </p>
              )}
            </div>
          )}

          {/* Plan Comparison */}
          <div className="mb-6">
            <h4 className="text-white font-semibold mb-4">Plan Features</h4>
            <div className="grid grid-cols-2 gap-3">
              {currentPlan.features && Object.entries(currentPlan.features).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 text-sm text-dark-200">
                  <div className={`w-4 h-4 rounded ${value ? 'bg-success' : 'bg-dark-600'}`} />
                  <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {currentPlan.id !== 'enterprise' && (
              <Button
                variant="primary"
                onClick={() => handleUpgradePlan(currentPlan.id === 'basic' ? 'pro' : 'enterprise')}
              >
                <Zap size={18} className="mr-2" />
                {currentPlan.id === 'basic' ? 'Upgrade to Pro' : 'Upgrade to Enterprise'}
              </Button>
            )}

            {currentPlan.id !== 'basic' && userSubscription?.status === 'active' && (
              <Button
                variant="secondary"
                onClick={() => setShowCancelConfirm(true)}
              >
                Cancel Subscription
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-dark-800 border border-dark-700 rounded-lg p-6 max-w-md"
          >
            <h3 className="text-xl font-bold text-white mb-2">Cancel Subscription?</h3>
            <p className="text-dark-300 mb-6">
              Are you sure you want to cancel your subscription? You'll lose access to premium features.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setShowCancelConfirm(false)}
              >
                Keep Subscription
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={handleCancelSubscription}
                disabled={isCancelling}
                isLoading={isCancelling}
              >
                Yes, Cancel
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Billing History Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-dark-800 rounded-lg p-6 border border-dark-700"
      >
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <CreditCard size={24} className="text-primary" />
          Billing History
        </h3>

        {isLoadingHistory ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : billingHistory.length === 0 ? (
          <p className="text-dark-300 text-center py-8">
            No billing history available
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-3 px-4 text-dark-300 font-semibold">Date</th>
                  <th className="text-left py-3 px-4 text-dark-300 font-semibold">Description</th>
                  <th className="text-right py-3 px-4 text-dark-300 font-semibold">Amount</th>
                  <th className="text-center py-3 px-4 text-dark-300 font-semibold">Status</th>
                  <th className="text-center py-3 px-4 text-dark-300 font-semibold">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {billingHistory.map((item, index) => (
                  <tr key={item.id} className="border-b border-dark-700 hover:bg-dark-700/30">
                    <td className="py-4 px-4 text-white">{formatDate(item.date)}</td>
                    <td className="py-4 px-4 text-dark-200">
                      {currentPlan?.name} Plan - Monthly Subscription
                    </td>
                    <td className="py-4 px-4 text-right text-white font-semibold">
                      ${(item.amount / 100).toFixed(2)}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {item.invoiceUrl ? (
                        <a
                          href={item.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-dark-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Plan Comparison Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-dark-800 rounded-lg p-6 border border-dark-700"
      >
        <h3 className="text-xl font-bold text-white mb-6">Upgrade Your Plan</h3>
        <p className="text-dark-300 mb-6">
          Want more features? Compare our plans and upgrade to unlock premium benefits.
        </p>
        <Button
          variant="primary"
          onClick={() => navigate('/select-plan')}
        >
          View All Plans
        </Button>
      </motion.div>

      {/* Support Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-dark-800 rounded-lg p-6 border border-dark-700 text-center"
      >
        <h3 className="text-lg font-bold text-white mb-2">Need Help?</h3>
        <p className="text-dark-300 mb-4">
          Have questions about your subscription or billing?
        </p>
        <a
          href="mailto:support@neofin.com"
          className="text-primary hover:text-primary/80 underline"
        >
          Contact Support
        </a>
      </motion.div>
    </div>
  );
};

export default SubscriptionSettings;
