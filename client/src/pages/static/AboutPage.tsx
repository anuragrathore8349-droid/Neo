import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const AboutPage: React.FC = () => (
  <div className="min-h-screen bg-dark-900 text-light">
    <div className="container mx-auto px-6 py-20">
      <div className="glass-card border border-dark-700 bg-dark-800/80 p-10 rounded-[32px] shadow-2xl">
        <Link to="/" className="inline-flex items-center gap-2 text-primary mb-10 hover:text-primary-light transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Home
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold mb-6">About NeoFin</h1>
        <p className="text-dark-300 text-lg leading-relaxed mb-6">
          NeoFin was founded with a simple mission: make institutional-grade financial tools accessible to everyone. We bridge the gap between traditional finance and the decentralized world, powered by cutting-edge AI.
        </p>
        <p className="text-dark-300 leading-relaxed mb-6">
          Our platform combines real-time market data, AI-driven insights, DeFi protocol integrations, and enterprise security — all in a single, intuitive interface. Whether you're a first-time investor or a seasoned fund manager, NeoFin gives you the edge.
        </p>

        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold mb-4">Our Mission</h2>
            <p className="text-dark-300 leading-relaxed">
              Democratize access to world-class financial intelligence. We believe everyone deserves the tools and insights that were once reserved for Wall Street.
            </p>
          </div>
          <div>
            <h2 className="text-3xl font-semibold mb-4">Our Values</h2>
            <ul className="space-y-4 text-dark-300">
              <li>🔒 <strong>Security First</strong> — We never compromise on the safety of your assets.</li>
              <li>🧠 <strong>AI-Driven</strong> — Every feature is enhanced by machine learning and real market data.</li>
              <li>🌍 <strong>Inclusive</strong> — Built for investors of all levels, from anywhere in the world.</li>
              <li>🔍 <strong>Transparent</strong> — Clear pricing, open audit logs, and honest communication.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default AboutPage;
