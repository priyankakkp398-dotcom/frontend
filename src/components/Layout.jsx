import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Gamepad2, PiggyBank, LogOut, Gift, CreditCard,
  ArrowLeftRight, User, TrendingUp, ChevronDown, Copy, Check, Menu, X,
  Wallet, CircleDollarSign, Flame, Crown, Headphones, Eye
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';

const navItems = [
  { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/game', label: 'Aviator', icon: Flame },
  { path: '/deposit', label: 'Deposit', icon: PiggyBank },
  { path: '/withdraw', label: 'Withdraw', icon: CreditCard },
  { path: '/support', label: 'Support', icon: Headphones },
  { path: '/refer-earn', label: 'Refer', icon: Gift },
  { path: '/transactions', label: 'History', icon: ArrowLeftRight },
  { path: '/manage-account', label: 'Bank', icon: TrendingUp },
  { path: '/profile', label: 'Profile', icon: User },
];

const bottomNavItems = [
  { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/game', label: 'Aviator', icon: Flame },
  { path: '/manage-account', label: 'Accounts', icon: Wallet },
  { path: '/refer-earn', label: 'Invite', icon: Gift },
  { path: '/profile', label: 'Profile', icon: User },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);

  const firstName = user?.full_name?.split(' ')[0] || 'User';
  const balance = parseFloat(user?.balance || 0);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const copyRefCode = () => {
    if (user?.referral_code) {
      navigator.clipboard.writeText(user.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-[#050505] flex">
      {/* SIDEBAR - Desktop only */}
      <aside className="hidden lg:flex lg:flex-col w-[220px] xl:w-[240px] sidebar-gradient fixed left-0 top-0 bottom-0 z-40">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-neon/10">
          <div className="w-8 h-8 rounded-lg bg-neon-green/10 flex items-center justify-center">
            <Flame size={18} className="text-neon-green" />
          </div>
          <div>
            <span className="font-orbitron text-neon-green text-sm font-bold tracking-wider">PHP</span>
            <span className="block text-[10px] text-gray-500 tracking-wider uppercase">Paisa Hi Paisa</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive(item.path)
                  ? 'active text-neon-green font-medium'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <item.icon size={17} className={isActive(item.path) ? 'text-neon-green' : ''} />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        {/* User section */}
        <div className="p-3 border-t border-neon/10">
          <div className="glass-card rounded-xl p-3 mb-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Balance</span>
              <Wallet size={12} className="text-neon-green" />
            </div>
            <span className="font-orbitron text-neon-green text-lg font-bold neon-text">
              ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <button onClick={handleLogout} className="btn-dark w-full py-2.5 rounded-lg text-sm flex items-center justify-center gap-2">
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass-solid">
        <div className="flex items-center justify-between h-14 px-3">
          <button onClick={() => setSidebarOpen(true)} className="btn-dark p-2 rounded-lg">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => window.location.href = 'mailto:paisahipaisa034@gmail.com'} className="btn-dark flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]">
              <Headphones size={14} className="text-neon-green" />
              <span className="text-gray-300 font-medium">Support</span>
            </button>
            <div className="balance-badge rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <Wallet size={14} className="text-neon-green" />
              <span className="font-orbitron text-neon-green text-xs font-bold">
                ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE SIDEBAR OVERLAY */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="absolute left-0 top-0 bottom-0 w-[260px] sidebar-gradient"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-14 flex items-center justify-between px-4 border-b border-neon/10">
                <div className="flex items-center gap-2">
                  <Flame size={18} className="text-neon-green" />
                  <span className="font-orbitron text-neon-green text-sm font-bold">PHP</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="btn-dark p-1.5 rounded-lg">
                  <X size={18} />
                </button>
              </div>
              <div className="p-3">
                <div className="glass-card rounded-xl p-3 mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-gray-500 uppercase">Balance</span>
                    <Wallet size={13} className="text-neon-green" />
                  </div>
                  <span className="font-orbitron text-neon-green text-lg font-bold">
                    ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <div className="px-2 space-y-0.5">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`nav-item flex items-center gap-3 px-4 py-3 rounded-lg text-sm ${
                      isActive(item.path)
                        ? 'active text-neon-green font-medium'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <item.icon size={18} className={isActive(item.path) ? 'text-neon-green' : ''} />
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-neon/10">
                <button onClick={handleLogout} className="btn-dark w-full py-3 rounded-lg text-sm flex items-center justify-center gap-2">
                  <LogOut size={15} />
                  Logout
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT */}
      <main className="flex-1 lg:ml-[220px] xl:ml-[240px] min-h-screen gradient-bg pb-16 lg:pb-6">
        <div className="lg:pt-0 pt-14">
          {children}
        </div>
      </main>

      {/* BOTTOM NAV - Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bottom-nav">
        <div className="flex items-center justify-around h-16 px-1">
          {bottomNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg transition-all min-w-[60px] ${
                isActive(item.path) ? 'text-neon-green' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <item.icon size={20} className={isActive(item.path) ? 'text-neon-green' : ''} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive(item.path) && <div className="w-4 h-0.5 rounded-full bg-neon-green mt-0.5" />}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
