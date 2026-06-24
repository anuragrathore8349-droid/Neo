import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Shield, Zap, Brain, Sparkles } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-900 to-dark-800 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10">
        {/* Header Section */}
        <div className="pt-16 sm:pt-20 pb-12 sm:pb-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Main Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-6">
                <Sparkles size={16} className="text-primary" />
                <span className="text-xs sm:text-sm font-medium text-primary">Choose Your Perfect Plan</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
                Unlock Your Investment
                <span className="block bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Potential Today
                </span>
              </h1>
              
              <p className="text-dark-300 text-base sm:text-lg lg:text-xl max-w-2xl mx-auto leading-relaxed">
                Get started with powerful trading tools, advanced analytics, and AI-driven insights.
                Choose the plan that fits your investment journey.
              </p>
            </motion.div>

            {/* Loading State */}
            {isLoading && allPlans.length === 0 && (
              <div className="flex items-center justify-center py-20">
                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
              </div>
            )}

            {/* Plans Grid */}
            {allPlans.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-16">
                {allPlans.map((plan, index) => {
                  const isPopular = plan.id === 'pro';

                  return (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.15, duration: 0.5 }}
                      className="h-full"
                    >
                      <div
                        className={`relative rounded-2xl overflow-hidden transition-all duration-300 h-full flex flex-col ${
                          isPopular
                            ? 'transform md:scale-105 ring-2 ring-primary'
                            : 'hover:shadow-xl'
                        }`}
                      >
                        {/* Gradient Border Effect */}
                        <div
                          className={`absolute inset-0 rounded-2xl p-[1px] pointer-events-none ${
                            isPopular
                              ? 'bg-gradient-to-br from-primary via-primary/50 to-primary/20'
                              : 'bg-gradient-to-br from-dark-700 to-dark-800'
                          }`}
                        >
                          <div
                            className={`absolute inset-0 rounded-2xl ${
                              isPopular ? 'bg-dark-800' : 'bg-dark-900'
                            }`}
                          ></div>
                        </div>

                        {/* Popular Badge */}
                        {isPopular && (
                          <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.4 }}
                            className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20"
                          >
                            <div className="bg-gradient-to-r from-primary to-primary/80 px-6 py-2 rounded-full shadow-lg">
                              <span className="text-dark-900 text-xs sm:text-sm font-bold whitespace-nowrap">
                                ⭐ MOST POPULAR
                              </span>
                            </div>
                          </motion.div>
                        )}

                        <div className="relative z-10 p-6 sm:p-8 flex flex-col h-full">
                          {/* Plan Header */}
                          <div className="mb-6 sm:mb-8">
                            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                              {plan.name}
                            </h3>
                            <div className="flex items-baseline gap-2 mb-4">
                              <span className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                                {plan.price === 0 ? 'Free' : `$${plan.price}`}
                              </span>
                              {plan.price > 0 && plan.period && (
                                <span className="text-dark-300 text-sm sm:text-base">/{plan.period}</span>
                              )}
                            </div>
                            {plan.price === 0 && plan.period && (
                              <span className="text-dark-300 text-base inline-block">{plan.period}</span>
                            )}
                          </div>

                          <p className="text-dark-300 text-sm sm:text-base mb-8 leading-relaxed min-h-[2.5rem]">
                            {plan.name === 'Basic' &&
                              'Perfect for getting started with basic portfolio tracking and essentials'}
                            {plan.name === 'Pro' &&
                              'For serious traders with advanced analytics, real-time data, and AI insights'}
                            {plan.name === 'Enterprise' &&
                              'For professional investors with full platform access and dedicated support'}
                          </p>

                          {/* Divider */}
                          <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent my-6"></div>

                          {/* Features List */}
                          <div className="mb-8 flex-grow">
                            <h4 className="text-white font-bold text-sm mb-5 flex items-center gap-2">
                              <Check size={16} className="text-primary" />
                              Features
                            </h4>
                            <ul className="space-y-4">
                              {/* Transaction Limit */}
                              <li className="flex items-start gap-3">
                                <Check size={18} className="text-primary mt-0.5 flex-shrink-0" />
                                <span className="text-dark-200 text-sm">
                                  {plan.features.maxTransactions === 'Unlimited'
                                    ? '✓ Unlimited transactions'
                                    : `✓ Up to ${plan.features.maxTransactions} transactions`}
                                </span>
                              </li>

                              {/* Advanced Analytics */}
                              <li className={`flex items-start gap-3 ${!plan.features.advancedAnalytics && 'opacity-50'}`}>
                                <Check
                                  size={18}
                                  className={`mt-0.5 flex-shrink-0 ${
                                    plan.features.advancedAnalytics ? 'text-primary' : 'text-dark-500'
                                  }`}
                                />
                                <span className="text-dark-200 text-sm">
                                  {plan.features.advancedAnalytics ? '✓' : '○'} Advanced analytics
                                </span>
                              </li>

                              {/* Real-time Data */}
                              <li className={`flex items-start gap-3 ${!plan.features.realTimeData && 'opacity-50'}`}>
                                <Check
                                  size={18}
                                  className={`mt-0.5 flex-shrink-0 ${
                                    plan.features.realTimeData ? 'text-primary' : 'text-dark-500'
                                  }`}
                                />
                                <span className="text-dark-200 text-sm">
                                  {plan.features.realTimeData ? '✓' : '○'} Real-time market data
                                </span>
                              </li>

                              {/* AI Insights */}
                              <li className={`flex items-start gap-3 ${!plan.features.aiInsights && 'opacity-50'}`}>
                                <Check
                                  size={18}
                                  className={`mt-0.5 flex-shrink-0 ${
                                    plan.features.aiInsights ? 'text-primary' : 'text-dark-500'
                                  }`}
                                />
                                <span className="text-dark-200 text-sm">
                                  {plan.features.aiInsights ? '✓' : '○'} AI-powered insights
                                </span>
                              </li>

                              {/* DeFi Integration */}
                              <li className={`flex items-start gap-3 ${!plan.features.defiIntegration && 'opacity-50'}`}>
                                <Check
                                  size={18}
                                  className={`mt-0.5 flex-shrink-0 ${
                                    plan.features.defiIntegration ? 'text-primary' : 'text-dark-500'
                                  }`}
                                />
                                <span className="text-dark-200 text-sm">
                                  {plan.features.defiIntegration ? '✓' : '○'} DeFi integration
                                </span>
                              </li>

                              {/* Dedicated Support */}
                              <li className={`flex items-start gap-3 ${!plan.features.dedicatedSupport && 'opacity-50'}`}>
                                <Check
                                  size={18}
                                  className={`mt-0.5 flex-shrink-0 ${
                                    plan.features.dedicatedSupport ? 'text-primary' : 'text-dark-500'
                                  }`}
                                />
                                <span className="text-dark-200 text-sm">
                                  {plan.features.dedicatedSupport
                                    ? '✓ Dedicated account manager'
                                    : '○ Community support'}
                                </span>
                              </li>

                              {/* API Access */}
                              <li className={`flex items-start gap-3 ${!plan.features.apiAccess && 'opacity-50'}`}>
                                <Check
                                  size={18}
                                  className={`mt-0.5 flex-shrink-0 ${
                                    plan.features.apiAccess ? 'text-primary' : 'text-dark-500'
                                  }`}
                                />
                                <span className="text-dark-200 text-sm">
                                  {plan.features.apiAccess ? '✓ Full API access' : '○ Basic API access'}
                                </span>
                              </li>
                            </ul>
                          </div>

                          {/* CTA Button */}
                          <motion.div
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Button
                              variant={isPopular ? 'primary' : 'secondary'}
                              fullWidth
                              onClick={() => handleSelectPlan(plan.id)}
                              disabled={isProcessing && selectedPlan === plan.id}
                              isLoading={isProcessing && selectedPlan === plan.id}
                              rightIcon={<ArrowRight size={18} />}
                              className={`text-sm sm:text-base font-semibold ${
                                isPopular
                                  ? 'bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg hover:shadow-primary/50'
                                  : 'hover:bg-dark-700'
                              }`}
                            >
                              {plan.price === 0 ? 'Get Started Free' : 'Upgrade Now'}
                            </Button>
                          </motion.div>

                          {plan.price > 0 && (
                            <p className="text-dark-400 text-xs text-center mt-4 font-medium">
                              7-day free trial • Cancel anytime
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Error State */}
            {!isLoading && allPlans.length === 0 && (
              <div className="text-center py-20">
                <Shield size={48} className="text-dark-500 mx-auto mb-4 opacity-50" />
                <p className="text-dark-300 text-base sm:text-lg">Unable to load plans. Please try again later.</p>
              </div>
            )}
          </div>
        </div>

        {/* Trust Section */}
        <div className="bg-gradient-to-r from-dark-800/50 to-dark-700/50 border-t border-b border-dark-700/50 py-16 sm:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-center text-white mb-4">
                Why Choose <span className="text-primary">NeoFin?</span>
              </h2>
              <p className="text-center text-dark-300 mb-12 max-w-2xl mx-auto">
                We provide the tools and insights you need to succeed in modern investing
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  {
                    icon: Shield,
                    title: 'Bank-level Security',
                    description: 'Your data is protected with enterprise-grade encryption and multi-layer security'
                  },
                  {
                    icon: Zap,
                    title: 'Real-time Updates',
                    description: 'Stay ahead with instant market notifications and live price tracking'
                  },
                  {
                    icon: Brain,
                    title: 'AI-Powered Insights',
                    description: 'Make smarter investment decisions with machine learning analysis'
                  }
                ].map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                    className="group relative"
                  >
                    <div className="relative p-6 sm:p-8 rounded-xl border border-dark-700/50 bg-dark-800/30 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/30 transition-colors duration-300">
                        <feature.icon size={24} className="text-primary" />
                      </div>
                      <h4 className="text-white font-bold text-lg mb-2">{feature.title}</h4>
                      <p className="text-dark-300 text-sm leading-relaxed">{feature.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* CTA Footer */}
        <div className="py-12 sm:py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                Still have questions?
              </h3>
              <p className="text-dark-300 text-base mb-6">
                Our team is here to help you find the perfect plan for your needs.
              </p>
              <a
                href="/support"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 border border-primary/50 font-semibold transition-all duration-300"
              >
                Contact Support
                <ArrowRight size={18} />
              </a>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanSelection;
