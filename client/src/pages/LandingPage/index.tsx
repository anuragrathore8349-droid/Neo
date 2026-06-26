import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useAnimation } from 'framer-motion';
import { ArrowRight, BarChart2, Zap, Shield, Brain, Globe, ChevronRight } from 'lucide-react';
import Logo from '../../components/common/Logo';

const LandingPage: React.FC = () => {
  const controls = useAnimation();

  useEffect(() => {
    controls.start({
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, staggerChildren: 0.1 }
    });
  }, [controls]);

  const features = [
    {
      icon: <BarChart2 size={24} className="text-primary" />,
      title: 'Advanced Analytics',
      description: 'Gain deep insights with our AI-powered analytics tools that help you make data-driven investment decisions.'
    },
    {
      icon: <Zap size={24} className="text-secondary" />,
      title: 'DeFi Integration',
      description: 'Seamlessly access decentralized finance protocols and maximize your yield opportunities.'
    },
    {
      icon: <Shield size={24} className="text-blue-400" />,
      title: 'Enterprise Security',
      description: 'Rest easy with institutional-grade security protecting your assets and personal information.'
    },
    {
      icon: <Brain size={24} className="text-purple-500" />,
      title: 'AI Predictions',
      description: 'Leverage machine learning algorithms to forecast market trends and identify opportunities.'
    },
    {
      icon: <Globe size={24} className="text-amber-500" />,
      title: 'Global Markets',
      description: 'Access traditional and crypto markets worldwide from a single unified platform.'
    }
  ];

  const testimonials = [
    {
      quote: "NeoFin has completely transformed how I manage my investments. The AI insights have been remarkably accurate.",
      author: "Sarah J.",
      position: "Retail Investor"
    },
    {
      quote: "The integration between traditional finance and DeFi is seamless. I've increased my portfolio yield by 12% since switching.",
      author: "Michael T.",
      position: "Hedge Fund Manager"
    },
    {
      quote: "As a financial advisor, I can confidently recommend NeoFin to my clients. The analytics tools are best-in-class.",
      author: "David L.",
      position: "Financial Advisor"
    }
  ];

  const plans = [
    {
      name: "Basic",
      price: "$0",
      period: "Free forever",
      features: [
        "Portfolio tracking",
        "Basic market data",
        "Limited transactions",
        "Email support"
      ],
      cta: "Get Started",
      popular: false
    },
    {
      name: "Pro",
      price: "$29",
      period: "per month",
      features: [
        "Advanced analytics",
        "Real-time market data",
        "Unlimited transactions",
        "AI insights (limited)",
        "Priority support"
      ],
      cta: "Start Free Trial",
      popular: true
    },
    {
      name: "Enterprise",
      price: "$99",
      period: "per month",
      features: [
        "Everything in Pro",
        "Full AI capabilities",
        "Custom integrations",
        "Dedicated account manager",
        "API access",
        "Team collaboration"
      ],
      cta: "Contact Sales",
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-dark-900/80 backdrop-blur-md border-b border-dark-800">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Logo />
            
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-dark-300 hover:text-light transition-colors">Features</a>
              <a href="#testimonials" className="text-dark-300 hover:text-light transition-colors">Testimonials</a>
              <a href="#pricing" className="text-dark-300 hover:text-light transition-colors">Pricing</a>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link to="/login" className="text-primary hover:text-primary-light transition-colors">Log In</Link>
              <Link to="/register" className="btn-primary">Get Started</Link>
            </div>
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto">
          <motion.div 
            className="max-w-3xl mx-auto text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={controls}
          >
            <motion.h1 
              className="text-4xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-blue-gradient"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              The Future of Finance is Here
            </motion.h1>
            
            <motion.p 
              className="text-xl md:text-2xl text-dark-300 mb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              NeoFin combines traditional finance with DeFi, powered by advanced AI to maximize your investment potential.
            </motion.p>
            
            <motion.div 
              className="flex flex-col sm:flex-row justify-center gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Link to="/register" className="btn-primary text-lg px-8 py-3">
                Get Started Free
              </Link>
              <a href="#features" className="btn-outline text-lg px-8 py-3">
                Learn More
              </a>
            </motion.div>
          </motion.div>
          
          <motion.div 
            className="mt-16 relative"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <div className="absolute inset-0 bg-blue-gradient opacity-10 blur-3xl rounded-3xl"></div>
            <div className="relative glass-card overflow-hidden rounded-xl border border-dark-700">
            <img 
  src="/Screenshot_1-3-2025_103827_localhost.jpeg" 
  alt="NeoFin Dashboard Preview" 
  className="w-full h-auto rounded-xl"
/>
            </div>
          </motion.div>
        </div>
      </section>
      
      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-dark-800/50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Powerful Features</h2>
            <p className="text-xl text-dark-300 max-w-2xl mx-auto">
              NeoFin combines cutting-edge technology with intuitive design to deliver a superior financial experience.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div 
                key={index}
                className="glass-card-hover p-6 rounded-xl"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="bg-dark-800/80 p-3 rounded-lg w-fit mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-dark-300">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">What Our Users Say</h2>
            <p className="text-xl text-dark-300 max-w-2xl mx-auto">
              Join thousands of satisfied users who have transformed their financial future with NeoFin.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div 
                key={index}
                className="glass-card p-6 rounded-xl"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="mb-4 text-primary">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.605 6C13.713 6 15 7.395 15 9.618C15 12.092 13.152 14 10.526 14C7.684 14 6 11.92 6 9.447C6 6.974 7.895 5 10.737 5C11.158 5 11.368 5.343 11.158 5.686L10.737 6.372C10.526 6.715 10.316 6.715 9.895 6.715C8.842 6.715 8 7.566 8 9.447C8 11.157 8.842 12.008 9.895 12.008C10.947 12.008 11.789 11.328 11.789 9.618C11.789 8.767 11.368 8.088 10.737 8.088H10.316C10.105 8.088 10 7.909 10 7.737V6.686C10 6.343 10.105 6 10.526 6H11.605Z" fill="currentColor"/>
                    <path d="M18.605 6C20.713 6 22 7.395 22 9.618C22 12.092 20.152 14 17.526 14C14.684 14 13 11.92 13 9.447C13 6.974 14.895 5 17.737 5C18.158 5 18.368 5.343 18.158 5.686L17.737 6.372C17.526 6.715 17.316 6.715 16.895 6.715C15.842 6.715 15 7.566 15 9.447C15 11.157 15.842 12.008 16.895 12.008C17.947 12.008 18.789 11.328 18.789 9.618C18.789 8.767 18.368 8.088 17.737 8.088H17.316C17.105 8.088 17 7.909 17 7.737V6.686C17 6.343 17.105 6 17.526 6H18.605Z" fill="currentColor"/>
                  </svg>
                </div>
                <p className="text-lg mb-6">{testimonial.quote}</p>
                <div>
                  <p className="font-semibold">{testimonial.author}</p>
                  <p className="text-dark-400 text-sm">{testimonial.position}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6 bg-dark-800/50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-dark-300 max-w-2xl mx-auto">
              Choose the plan that fits your needs. All plans include core features with no hidden fees.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <motion.div 
                key={index}
                className={`glass-card p-6 rounded-xl relative ${plan.popular ? 'border-primary' : 'border-dark-700'}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-dark-400 ml-1">{plan.period}</span>
                </div>
                <ul className="mb-6 space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center">
                      <ChevronRight size={16} className="text-primary mr-2" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.name === 'Enterprise' ? '/contact' : '/register'}
                  className={`block text-center w-full py-2 rounded-lg font-medium transition-colors ${plan.popular ? 'btn-primary' : 'btn-outline'}`}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <motion.div 
            className="max-w-4xl mx-auto text-center glass-card p-12 rounded-2xl relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="absolute inset-0 bg-blue-gradient opacity-10"></div>
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Transform Your Financial Future?</h2>
              <p className="text-xl text-dark-300 mb-8 max-w-2xl mx-auto">
                Join thousands of investors who are already leveraging NeoFin to achieve their financial goals.
              </p>
              <Link to="/register" className="btn-primary text-lg px-8 py-3 inline-flex items-center">
                Get Started Now
                <ArrowRight size={20} className="ml-2" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-12 px-6 bg-dark-800">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div>
              <Logo />
              <p className="mt-4 text-dark-300">
                The next generation financial platform combining traditional finance with DeFi.
              </p>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-dark-300 hover:text-light transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-dark-300 hover:text-light transition-colors">Pricing</a></li>
                <li><Link to="/security-info" className="text-dark-300 hover:text-light transition-colors">Security</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Resources</h4>
              <ul className="space-y-2">
                <li><Link to="/" className="text-dark-300 hover:text-light transition-colors">Documentation</Link></li>
                <li><Link to="/"  className="text-dark-300 hover:text-light transition-colors">API</Link></li>
                <li><Link to="/" className="text-dark-300 hover:text-light transition-colors">Guides</Link></li>
                <li><Link to="/" className="text-dark-300 hover:text-light transition-colors">Blog</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><Link to="/about" className="text-dark-300 hover:text-light transition-colors">About</Link></li>
                <li><Link to="/contact" className="text-dark-300 hover:text-light transition-colors">Careers</Link></li>
                <li><Link to="/contact" className="text-dark-300 hover:text-light transition-colors">Contact</Link></li>
                <li><Link to="/terms" className="text-dark-300 hover:text-light transition-colors">Legal</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-dark-700 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-dark-400 mb-4 md:mb-0">© 2025 NeoFin. All rights reserved.</p>
            <div className="flex space-x-6">
              <Link to="/terms" className="text-dark-400 hover:text-light transition-colors">Terms</Link>
              <Link to="/privacy" className="text-dark-400 hover:text-light transition-colors">Privacy</Link>
              <Link to="/cookies" className="text-dark-400 hover:text-light transition-colors">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;