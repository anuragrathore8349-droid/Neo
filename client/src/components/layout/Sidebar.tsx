import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  PieChart, 
  BarChart3, 
  Wallet, 
  Zap, 
  Brain, 
  Settings, 
  BookOpen, 
  Shield, 
  LogOut 
} from 'lucide-react';
import Logo from '../common/Logo';
import { useAuth } from '../../context/AuthContext';

const Sidebar: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Portfolio', path: '/portfolio', icon: <PieChart size={20} /> },
    { name: 'Trading', path: '/trading', icon: <BarChart3 size={20} /> },
    { name: 'Wallet', path: '/wallet', icon: <Wallet size={20} /> },
    { name: 'DeFi', path: '/defi', icon: <Zap size={20} /> },
    { name: 'AI Insights', path: '/ai-insights', icon: <Brain size={20} /> },
    { name: 'Learning', path: '/learning', icon: <BookOpen size={20} /> },
    { name: 'Security', path: '/security', icon: <Shield size={20} /> },
    { name: 'Settings', path: '/settings', icon: <Settings size={20} /> },
  ];

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-dark-800 border-r border-dark-700 flex flex-col z-10">
      <div className="p-6">
        <Logo />
      </div>
      
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {navLinks.map((link) => (
            <li key={link.path}>
              <NavLink 
                to={link.path} 
                className={({ isActive }) => 
                  isActive ? 'sidebar-link active' : 'sidebar-link'
                }
              >
                {link.icon}
                <span>{link.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-dark-700">
        <button className="sidebar-link w-full justify-center" onClick={handleLogout}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;