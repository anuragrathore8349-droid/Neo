import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, AlertTriangle, Key, Activity } from 'lucide-react';

const items = [
  { icon: <Shield className="w-6 h-6 text-emerald-400" />, title: 'Bank-Grade Encryption', desc: 'AES-256 encryption for all data at rest and TLS 1.3 for all data in transit.' },
  { icon: <Lock className="w-6 h-6 text-sky-400" />, title: 'Two-Factor Authentication', desc: 'TOTP-based 2FA on every account with backup codes and hardware key support.' },
  { icon: <Eye className="w-6 h-6 text-violet-400" />, title: 'Anomaly Detection', desc: 'AI-powered real-time monitoring flags unusual login patterns and suspicious activity.' },
  { icon: <AlertTriangle className="w-6 h-6 text-yellow-400" />, title: 'Fraud Prevention', desc: 'Multi-layer risk scoring on every transaction to prevent unauthorized access.' },
  { icon: <Key className="w-6 h-6 text-cyan-400" />, title: 'API Key Management', desc: 'Granular scoped API keys with IP whitelisting and expiry controls.' },
  { icon: <Activity className="w-6 h-6 text-rose-400" />, title: 'Full Audit Logs', desc: 'Every action is logged with timestamps, IP addresses, and device fingerprints.' },
];

const SecurityPage: React.FC = () => (
  <div className="min-h-screen bg-dark-900 text-light">
    <div className="container mx-auto px-6 py-20">
      <div className="glass-card border border-dark-700 bg-dark-800/80 p-10 rounded-[32px] shadow-2xl">
        <Link to="/" className="inline-flex items-center gap-2 text-primary mb-10 hover:text-primary-light transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Home
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold mb-4">Security</h1>
        <p className="text-dark-300 text-lg mb-12 max-w-2xl">
          Your security is our top priority. NeoFin is built from the ground up with protection at every layer.
        </p>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.title} className="glass-card border border-dark-700 bg-dark-900/80 p-6 rounded-3xl shadow-xl hover:border-primary transition-colors">
              <div className="mb-4">{item.icon}</div>
              <h3 className="font-semibold text-xl mb-3">{item.title}</h3>
              <p className="text-dark-300 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default SecurityPage;
