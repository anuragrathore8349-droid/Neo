import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

type Tab = 'terms' | 'privacy' | 'cookies';

const content: Record<Tab, { title: string; body: string }> = {
  terms: {
    title: 'Terms of Service',
    body: `Last updated: January 2025

By accessing or using NeoFin ("the Platform"), you agree to be bound by these Terms of Service.

1. USE OF THE PLATFORM
NeoFin provides financial data, analytics tools, and portfolio management features. The Platform is intended for informational purposes only and does not constitute financial advice.

2. ELIGIBILITY
You must be at least 18 years old and have the legal capacity to enter into a binding agreement to use this Platform.

3. ACCOUNT RESPONSIBILITY
You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.

4. NO FINANCIAL ADVICE
Nothing on NeoFin constitutes investment advice. All content is for informational purposes only. Always consult a qualified financial advisor before making investment decisions.

5. LIMITATION OF LIABILITY
NeoFin shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Platform.

6. MODIFICATIONS
We reserve the right to modify these Terms at any time. Continued use of the Platform after changes constitutes acceptance.

Contact us at legal@neofin.io with any questions.`,
  },
  privacy: {
    title: 'Privacy Policy',
    body: `Last updated: January 2025

Your privacy is important to us. This policy explains how NeoFin collects, uses, and protects your personal information.

1. INFORMATION WE COLLECT
- Account information (name, email, password hash)
- Portfolio data you add to the platform
- Usage analytics (anonymised)
- IP address and device information for security

2. HOW WE USE YOUR INFORMATION
- To provide and improve our services
- To send service notifications and updates
- To detect and prevent fraud
- To comply with legal obligations

3. DATA SHARING
We do not sell your personal data. We may share data with service providers (e.g., payment processors) only as necessary to deliver our services.

4. DATA RETENTION
We retain your data for as long as your account is active or as required by law.

5. YOUR RIGHTS
You have the right to access, correct, or delete your personal data at any time via Settings → Profile.

Contact us at privacy@neofin.io for data requests.`,
  },
  cookies: {
    title: 'Cookie Policy',
    body: `Last updated: January 2025

NeoFin uses cookies and similar technologies to enhance your experience.

1. WHAT ARE COOKIES
Cookies are small text files stored on your device that help us recognise you and remember your preferences.

2. COOKIES WE USE
- Essential cookies: Required for authentication and security
- Analytics cookies: Help us understand how the Platform is used (anonymised)
- Preference cookies: Remember your settings (theme, language)

3. MANAGING COOKIES
You can control cookies through your browser settings. Disabling essential cookies may break core functionality.

4. THIRD-PARTY COOKIES
We may use third-party services (e.g., analytics) that set their own cookies. We do not control these cookies.

Contact us at privacy@neofin.io with any questions.`,
  },
};

const LegalPage: React.FC<{ defaultTab?: Tab }> = ({ defaultTab = 'terms' }) => {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const { title, body } = content[tab];

  return (
    <div className="min-h-screen bg-dark-900 text-light">
      <div className="container mx-auto px-6 py-20">
        <div className="glass-card border border-dark-700 bg-dark-800/80 p-10 rounded-[32px] shadow-2xl">
          <Link to="/" className="inline-flex items-center gap-2 text-primary mb-10 hover:text-primary-light transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
            <h1 className="text-4xl md:text-5xl font-bold">Legal</h1>
            <div className="flex flex-wrap gap-2">
              {(['terms', 'privacy', 'cookies'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-3xl px-4 py-2 text-sm font-medium transition-colors ${tab === t ? 'bg-primary text-white' : 'bg-dark-900 border border-dark-700 text-dark-300 hover:bg-dark-800'}`}
                >
                  {t === 'terms' ? 'Terms' : t === 'privacy' ? 'Privacy' : 'Cookies'}
                </button>
              ))}
            </div>
          </div>

          <h2 className="text-3xl font-semibold mb-6">{title}</h2>
          <div className="text-dark-300 whitespace-pre-wrap leading-relaxed text-sm">{body}</div>
        </div>
      </div>
    </div>
  );
};

export default LegalPage;
