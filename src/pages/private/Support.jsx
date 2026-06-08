import { Mail } from 'lucide-react';

export default function Support() {
  return (
    <div className="p-2 md:p-3 space-y-2">
      <div className="glass-card rounded-2xl p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-neon-green/10 flex items-center justify-center mx-auto mb-4">
          <Mail size={32} className="text-neon-green" />
        </div>
        <p className="text-white text-sm font-bold mb-1">Need Help?</p>
        <p className="text-gray-500 text-xs mb-6">Reach out to our support team</p>

        <a
          href="mailto:paisahipaisa034@gmail.com"
          className="btn-neon w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
        >
          <Mail size={18} />
          <span>Email Support</span>
        </a>
      </div>
    </div>
  );
}
