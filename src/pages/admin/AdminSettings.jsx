import { useState, useEffect } from 'react';
import { Settings, Smartphone, Gift, Gamepad2, Save, Headphones, MessageCircle, Send, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

export default function AdminSettings() {
  const [payment, setPayment] = useState({ upiId: '', qrCode: '' });
  const [bonus, setBonus] = useState(50);
  const [speed, setSpeed] = useState(0.015);
  const [rtp, setRtp] = useState(94);
  const [lowCrashFreq, setLowCrashFreq] = useState(25);
  const [highMultFreq, setHighMultFreq] = useState(2);
  const [support, setSupport] = useState({ telegram: '', whatsapp: '' });
  const [loading, setLoading] = useState({ payment: false, bonus: false, game: false, support: false });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    api.get('/admin/payment-settings').then(({ data }) => {
      if (data.success && data.data) {
        setPayment({ upiId: data.data.upi_id || '', qrCode: data.data.qr_code || '' });
      }
    }).catch(() => {});
    api.get('/admin/game-settings').then(({ data }) => {
      if (data.success && data.data) {
        if (typeof data.data.speed === 'number') setSpeed(data.data.speed);
        if (typeof data.data.rtp === 'number') setRtp(data.data.rtp);
        if (typeof data.data.lowCrashFrequency === 'number') setLowCrashFreq(data.data.lowCrashFrequency);
        if (typeof data.data.highMultiplierFrequency === 'number') setHighMultFreq(data.data.highMultiplierFrequency);
      }
    }).catch(() => {});
    api.get('/support').then(({ data }) => {
      if (data.success && data.data) {
        setSupport({ telegram: data.data.telegram || '', whatsapp: data.data.whatsapp || '' });
      }
    }).catch(() => {});
  }, []);

  const savePayment = async (e) => {
    e.preventDefault();
    setLoading(p => ({ ...p, payment: true }));
    try {
      const { data } = await api.put('/admin/payment-settings', payment);
      if (data.success) toast.success('Payment settings saved!');
      else toast.error(data.message);
    } catch { toast.error('Failed'); }
    finally { setLoading(p => ({ ...p, payment: false })); }
  };

  const saveBonus = async (e) => {
    e.preventDefault();
    setLoading(p => ({ ...p, bonus: true }));
    try {
      const { data } = await api.put('/admin/referral-bonus', { bonus: parseFloat(bonus) });
      if (data.success) toast.success('Referral bonus updated!');
      else toast.error(data.message);
    } catch { toast.error('Failed'); }
    finally { setLoading(p => ({ ...p, bonus: false })); }
  };

  const saveSupport = async (e) => {
    e.preventDefault();
    setLoading(p => ({ ...p, support: true }));
    try {
      const { data } = await api.put('/admin/support-settings', support);
      if (data.success) toast.success('Support settings saved!');
      else toast.error(data.message);
    } catch { toast.error('Failed'); }
    finally { setLoading(p => ({ ...p, support: false })); }
  };

  const saveGame = async (e) => {
    e.preventDefault();
    const parsedSpeed = parseFloat(speed);
    if (isNaN(parsedSpeed) || parsedSpeed < 0) return toast.error('Enter a valid non-negative speed');
    setLoading(p => ({ ...p, game: true }));
    try {
      const { data } = await api.put('/admin/game-settings', {
        speed: parsedSpeed,
        rtp: parseFloat(rtp),
        lowCrashFrequency: parseFloat(lowCrashFreq),
        highMultiplierFrequency: parseFloat(highMultFreq)
      });
      if (data.success) {
        if (data.data) {
          if (typeof data.data.speed === 'number') setSpeed(data.data.speed);
          if (typeof data.data.rtp === 'number') setRtp(data.data.rtp);
          if (typeof data.data.lowCrashFrequency === 'number') setLowCrashFreq(data.data.lowCrashFrequency);
          if (typeof data.data.highMultiplierFrequency === 'number') setHighMultFreq(data.data.highMultiplierFrequency);
        }
        toast.success('Game settings updated!');
      } else toast.error(data.message);
    } catch { toast.error('Failed to save game settings'); }
    finally { setLoading(p => ({ ...p, game: false })); }
  };

  const handleResetData = async () => {
    setResetting(true);
    try {
      const { data } = await api.post('/admin/reset-data');
      if (data.success) {
        toast.success('All user data has been reset!');
        setShowResetConfirm(false);
      } else toast.error(data.message);
    } catch { toast.error('Failed to reset data'); }
    finally { setResetting(false); }
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Settings size={18} className="text-neon-green" />
        <h1 className="text-lg font-bold">Settings</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Payment */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone size={16} className="text-neon-green" />
            <h3 className="text-white text-xs font-bold uppercase tracking-wider">Payment</h3>
          </div>
          <form onSubmit={savePayment} className="space-y-2">
            <input type="text" value={payment.upiId} onChange={e => setPayment(p => ({ ...p, upiId: e.target.value }))}
              placeholder="UPI ID" className="input-neon rounded-lg px-3 py-2.5 text-xs" />
            <input type="text" value={payment.qrCode} onChange={e => setPayment(p => ({ ...p, qrCode: e.target.value }))}
              placeholder="QR Code URL (optional)" className="input-neon rounded-lg px-3 py-2.5 text-xs" />
            <button type="submit" disabled={loading.payment}
              className="btn-neon w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5">
              <Save size={13} /> {loading.payment ? 'Saving...' : 'Save Payment'}
            </button>
          </form>
        </div>

        {/* Referral */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Gift size={16} className="text-neon-green" />
            <h3 className="text-white text-xs font-bold uppercase tracking-wider">Referral Bonus</h3>
          </div>
          <form onSubmit={saveBonus} className="space-y-2">
            <input type="number" value={bonus} onChange={e => setBonus(e.target.value)}
              placeholder="Bonus amount (₹)" className="input-neon rounded-lg px-3 py-2.5 text-xs" />
            <button type="submit" disabled={loading.bonus}
              className="btn-neon w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5">
              <Save size={13} /> {loading.bonus ? 'Saving...' : 'Save Bonus'}
            </button>
          </form>
        </div>

        {/* Game */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Gamepad2 size={16} className="text-neon-green" />
            <h3 className="text-white text-xs font-bold uppercase tracking-wider">Game Speed</h3>
          </div>
          <form onSubmit={saveGame} className="space-y-2">
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Speed</label>
              <input type="number" value={speed} onChange={e => setSpeed(e.target.value)} step="0.001"
                placeholder="Speed (0.01-0.05)" className="input-neon rounded-lg px-3 py-2.5 text-xs w-full" />
              <p className="text-gray-600 text-[10px]">Higher = faster multiplier increase</p>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">RTP % (80-99)</label>
              <input type="number" value={rtp} onChange={e => setRtp(e.target.value)} step="0.5" min="80" max="99"
                className="input-neon rounded-lg px-3 py-2.5 text-xs w-full" />
              <p className="text-gray-600 text-[10px]">Default 94%. Higher = more payouts to players</p>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Low Crash Freq % (5-50)</label>
              <input type="number" value={lowCrashFreq} onChange={e => setLowCrashFreq(e.target.value)} step="1" min="5" max="50"
                className="input-neon rounded-lg px-3 py-2.5 text-xs w-full" />
              <p className="text-gray-600 text-[10px]">Default 25%. Higher = more crashes under 2x</p>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">High Mult Freq % (0.5-10)</label>
              <input type="number" value={highMultFreq} onChange={e => setHighMultFreq(e.target.value)} step="0.5" min="0.5" max="10"
                className="input-neon rounded-lg px-3 py-2.5 text-xs w-full" />
              <p className="text-gray-600 text-[10px]">Default 2%. Higher = more 50x+ rounds</p>
            </div>
            <button type="submit" disabled={loading.game}
              className="btn-neon w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5">
              <Save size={13} /> {loading.game ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>

        {/* Support */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Headphones size={16} className="text-neon-green" />
            <h3 className="text-white text-xs font-bold uppercase tracking-wider">Support Links</h3>
          </div>
          <form onSubmit={saveSupport} className="space-y-2">
            <div className="flex items-center gap-2">
              <Send size={14} className="text-blue-400 shrink-0" />
              <input type="text" value={support.telegram} onChange={e => setSupport(p => ({ ...p, telegram: e.target.value }))}
                placeholder="Telegram username or link" className="input-neon rounded-lg px-3 py-2.5 text-xs flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <MessageCircle size={14} className="text-green-400 shrink-0" />
              <input type="text" value={support.whatsapp} onChange={e => setSupport(p => ({ ...p, whatsapp: e.target.value }))}
                placeholder="WhatsApp number (with country code)" className="input-neon rounded-lg px-3 py-2.5 text-xs flex-1" />
            </div>
            <p className="text-gray-600 text-[10px]">Telegram: username or full URL. WhatsApp: full number with country code (e.g. 919876543210)</p>
            <button type="submit" disabled={loading.support}
              className="btn-neon w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5">
              <Save size={13} /> {loading.support ? 'Saving...' : 'Save Support'}
            </button>
          </form>
        </div>
        {/* Reset Data */}
        <div className="glass-card rounded-xl p-4 border border-red-500/20">
          <div className="flex items-center gap-2 mb-3">
            <Trash2 size={16} className="text-red-400" />
            <h3 className="text-white text-xs font-bold uppercase tracking-wider">Reset Data</h3>
          </div>
          <p className="text-gray-500 text-[10px] mb-3">This will permanently delete all users, bets, transactions, withdrawals, deposits, and game rounds. Admin accounts are kept. This action cannot be undone.</p>
          {showResetConfirm ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-red-400 text-[10px]">
                <AlertTriangle size={12} />
                <span>Are you sure?</span>
              </div>
              <button onClick={handleResetData} disabled={resetting}
                className="btn-neon bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30 py-2 px-3 rounded-lg text-xs font-bold">
                {resetting ? 'Resetting...' : 'Yes, Reset All'}
              </button>
              <button onClick={() => setShowResetConfirm(false)}
                className="btn-dark py-2 px-3 rounded-lg text-xs">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setShowResetConfirm(true)}
              className="btn-neon bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 w-full">
              <Trash2 size={13} /> Reset All Data
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
