import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, MessageSquare, Send } from 'lucide-react';

const ContactPage: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-dark-900 text-light">
      <div className="container mx-auto px-6 py-20">
        <div className="glass-card border border-dark-700 bg-dark-800/80 p-10 rounded-[32px] shadow-2xl">
          <Link to="/" className="inline-flex items-center gap-2 text-primary mb-10 hover:text-primary-light transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">Contact Us</h1>
          <p className="text-dark-300 mb-10 max-w-2xl">
            Have a question, bug report, or want to explore an enterprise partnership? We'd love to hear from you.
          </p>

          {submitted ? (
            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-3xl p-8 text-emerald-200 text-center">
              <MessageSquare className="w-10 h-10 mx-auto mb-3" />
              <p className="text-lg font-semibold">Message sent! We'll get back to you within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-6">
              <div>
                <label className="text-sm text-dark-300 mb-2 block">Name</label>
                <input
                  required
                  className="w-full rounded-3xl border border-dark-700 bg-dark-900 px-4 py-3 text-light focus:border-primary focus:outline-none transition-colors"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="text-sm text-dark-300 mb-2 block">Email</label>
                <input
                  required
                  type="email"
                  className="w-full rounded-3xl border border-dark-700 bg-dark-900 px-4 py-3 text-light focus:border-primary focus:outline-none transition-colors"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="text-sm text-dark-300 mb-2 block">Message</label>
                <textarea
                  required
                  rows={6}
                  className="w-full rounded-3xl border border-dark-700 bg-dark-900 px-4 py-3 text-light focus:border-primary focus:outline-none transition-colors resize-none"
                  value={form.message}
                  onChange={e => setForm({ ...form, message: e.target.value })}
                  placeholder="How can we help?"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-3xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
              >
                <Send className="w-4 h-4" /> Send Message
              </button>
            </form>
          )}

          <div className="mt-12 pt-8 border-t border-dark-700">
            <p className="text-dark-300 flex items-center gap-2">
              <Mail className="w-4 h-4" /> support@neofin.io
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
