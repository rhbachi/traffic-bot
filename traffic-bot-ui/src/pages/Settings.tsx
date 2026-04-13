import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Check, Eye, EyeOff } from "lucide-react";

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [captchaKey, setCaptchaKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s);
      setCaptchaKey(s.captcha_api_key || "");
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateSettings({ ...settings, captcha_api_key: captchaKey });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
    setSaving(false);
  };

  return (
    <div className="p-6 max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-xs text-gray-500 mt-0.5">Configure integrations and global options</p>
      </div>

      {/* CAPTCHA Solving */}
      <section className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white">CAPTCHA Solving (2captcha)</h2>
          <p className="text-xs text-gray-500 mt-1">
            Automatically solve Google reCAPTCHA when detected. Requires a{" "}
            <span className="text-gray-400">2captcha.com</span> account (~$3 per 1000 CAPTCHAs).
          </p>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">2captcha API Key</label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              className="input pr-9"
              value={captchaKey}
              onChange={(e) => setCaptchaKey(e.target.value)}
              placeholder="Enter your 2captcha API key"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-[11px] text-gray-600 mt-1">
            Leave empty to disable CAPTCHA solving (bot will fall back to direct URL visit).
          </p>
        </div>

        {captchaKey && (
          <div className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-3 py-2">
            CAPTCHA solving enabled — Google campaigns will automatically solve reCAPTCHA.
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-gray-950 text-sm font-semibold rounded disabled:opacity-50 transition-colors"
        >
          <Check size={13} />
          {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
