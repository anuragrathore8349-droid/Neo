import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Shield, Zap, Brain } from 'lucide-react';
import AuthLayout from '../../../components/common/AuthLayout';
import Button from '../../../components/common/Button/Button';
import { usePlan } from '../../../context/PlanContext';
import { toast } from 'react-toastify';

const PlanSelection: React.FC = () => {
  const navigate = useNavigate();
  const { allPlans, upgradeToPlans, isLoading } = usePlan();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSelectPlan = async (planId: string) => {
    try {
      setIsProcessing(true);
      setSelectedPlan(planId);
      await upgradeToPlans(planId);
      
      // If no redirect (free plan), navigate to dashboard
      if (planId === 'basic') {
        toast.success('Welcome to NeoFin!');
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to select plan');
      setIsProcessing(false);
    }
  };

  return (
    <AuthLayout
      title="Choose Your Plan"
      subtitle="Select the perfect plan to start your investment journey with NeoFin"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Loading State */}
        {isLoading && allPlans.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Plans Grid */}
        {allPlans.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-12">
            {allPlans.map((plan, index) => {
              const isPopular = plan.id === 'pro';

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.3 }}
                  className={`relative rounded-xl border-2 transition-all duration-300 overflow-hidden ${
                    isPopular
                      ? 'border-primary bg-dark-800 ring-2 ring-primary ring-opacity-50 sm:scale-105'
                      : 'border-dark-700 bg-dark-900 hover:border-primary/50'
                  }`}
                >
                {/* Popular Badge */}
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-primary px-4 py-1 rounded-full shadow-lg">
                      <span className="text-dark-900 text-xs sm:text-sm font-semibold whitespace-nowrap">
                        Most Popular
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-6 sm:p-8 flex flex-col h-full">
                  {/* Plan Header */}
                  <div className="mb-6 sm:mb-8">
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-3xl sm:text-4xl font-bold text-primary">
                        {plan.price === 0 ? 'Free' : `$${plan.price}`}
                      </span>
                      {plan.price > 0 && plan.period && (
                        <span className="text-dark-300 text-sm sm:text-base">{plan.period}</span>
                      )}
                      {plan.price === 0 && plan.period && (
                        <span className="text-dark-300 text-base sm:text-lg">{plan.period}</span>
                      )}
                    </div>
                  </div>

                  <p className="text-dark-300 text-xs sm:text-sm mb-6 sm:mb-8 min-h-[3rem]">
                    {plan.name === 'Basic' &&
                      'Perfect for getting started with basic portfolio tracking'}
                    {plan.name === 'Pro' &&
                      'For serious traders with advanced analytics and real-time data'}
                    {plan.name === 'Enterprise' &&
                      'For professional investors with full platform access'}
                  </p>

                  {/* Features List */}
                  <div className="mb-8 flex-grow">
                    <h4 className="text-white font-semibold text-sm mb-4">
                      Features:
                    </h4>
                    <ul className="space-y-3">
                      {/* Transaction Limit */}
                      <li className="flex items-start gap-3">
                        <Check size={18} className="text-success mt-0.5 flex-shrink-0" />
                        <span className="text-dark-200 text-xs sm:text-sm">
                          {plan.features.maxTransactions === 'Unlimited'
                            ? 'Unlimited transactions'
                            : `Up to ${plan.features.maxTransactions} transactions`}
                        </span>
                      </li>

                      {/* Advanced Analytics */}
                      <li className={`flex items-start gap-3 ${!plan.features.advancedAnalytics && 'opacity-50'}`}>
                        <Check
                          size={18}
                          className={`mt-0.5 flex-shrink-0 ${
                            plan.features.advancedAnalytics ? 'text-success' : 'text-dark-500'
                          }`}
                        />
                        <span className="text-dark-200 text-xs sm:text-sm">
                          Advanced analytics
                        </span>
                      </li>

                      {/* Real-time Data */}
                      <li className={`flex items-start gap-3 ${!plan.features.realTimeData && 'opacity-50'}`}>
                        <Check
                          size={18}
                          className={`mt-0.5 flex-shrink-0 ${
                            plan.features.realTimeData ? 'text-success' : 'text-dark-500'
                          }`}
                        />
                        <span className="text-dark-200 text-xs sm:text-sm">
                          Real-time market data
                        </span>
                      </li>

                      {/* AI Insights */}
                      <li className={`flex items-start gap-3 ${!plan.features.aiInsights && 'opacity-50'}`}>
                        <Check
                          size={18}
                          className={`mt-0.5 flex-shrink-0 ${
                            plan.features.aiInsights ? 'text-success' : 'text-dark-500'
                          }`}
                        />
                        <span className="text-dark-200 text-xs sm:text-sm">
                          AI-powered insights
                        </span>
                      </li>

                      {/* DeFi Integration */}
                      <li className={`flex items-start gap-3 ${!plan.features.defiIntegration && 'opacity-50'}`}>
                        <Check
                          size={18}
                          className={`mt-0.5 flex-shrink-0 ${
                            plan.features.defiIntegration ? 'text-success' : 'text-dark-500'
                          }`}
                        />
                        <span className="text-dark-200 text-xs sm:text-sm">
                          DeFi integration
                        </span>
                      </li>

                      {/* Dedicated Support */}
                      <li className={`flex items-start gap-3 ${!plan.features.dedicatedSupport && 'opacity-50'}`}>
                        <Check
                          size={18}
                          className={`mt-0.5 flex-shrink-0 ${
                            plan.features.dedicatedSupport ? 'text-success' : 'text-dark-500'
                          }`}
                        />
                        <span className="text-dark-200 text-xs sm:text-sm">
                          {plan.features.dedicatedSupport
                            ? 'Dedicated account manager'
                            : 'Community support'}
                        </span>
                      </li>

                      {/* API Access */}
                      <li className={`flex items-start gap-3 ${!plan.features.apiAccess && 'opacity-50'}`}>
                        <Check
                          size={18}
                          className={`mt-0.5 flex-shrink-0 ${
                            plan.features.apiAccess ? 'text-success' : 'text-dark-500'
                          }`}
                        />
                        <span className="text-dark-200 text-xs sm:text-sm">
                          {plan.features.apiAccess ? 'Full API access' : 'Basic API access'}
                        </span>
                      </li>
                    </ul>
                  </div>

                  {/* CTA Button */}
                  <Button
                    variant={isPopular ? 'primary' : 'secondary'}
                    fullWidth
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isProcessing && selectedPlan === plan.id}
                    isLoading={isProcessing && selectedPlan === plan.id}
                    rightIcon={<ArrowRight size={18} />}
                    className="text-sm sm:text-base"
                  >
                    {plan.price === 0 ? 'Get Started' : 'Upgrade Now'}
                  </Button>

                  {plan.price > 0 && (
                    <p className="text-dark-400 text-xs text-center mt-3">
                      7-day free trial. Cancel anytime.
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
          </div>
        )}

        {/* Error State */}
        {!isLoading && allPlans.length === 0 && (
          <div className="text-center py-12">
            <p className="text-dark-300 text-sm sm:text-base lg:text-lg">Unable to load plans. Please try again later.</p>
          </div>
        )}

        {/* Trust Section */}
        <div className="bg-dark-800 rounded-xl p-6 sm:p-8 lg:p-10 text-center border border-dark-700 mt-12 sm:mt-16">
          <h3 className="text-lg sm:text-xl font-semibold mb-6 sm:mb-8">Why choose NeoFin?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Shield size={28} className="text-primary" />
              </div>
              <h4 className="text-white font-semibold text-sm sm:text-base">Bank-level Security</h4>
              <p className="text-dark-300 text-xs sm:text-sm">
                Your data is protected with enterprise-grade encryption
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Zap size={28} className="text-primary" />
              </div>
              <h4 className="text-white font-semibold text-sm sm:text-base">Real-time Updates</h4>
              <p className="text-dark-300 text-xs sm:text-sm">
                Stay informed with instant market notifications
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Brain size={28} className="text-primary" />
              </div>
              <h4 className="text-white font-semibold text-sm sm:text-base">AI-Powered Insights</h4>
              <p className="text-dark-300 text-xs sm:text-sm">
                Make smarter investment decisions with AI analysis
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-8 sm:mt-12 text-center">
          <p className="text-dark-300 text-xs sm:text-sm">
            Have questions about our plans?{' '}
            <a href="/support" className="text-primary hover:text-primary/80 font-semibold">
              Contact our support team
            </a>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
};

export default PlanSelection;
