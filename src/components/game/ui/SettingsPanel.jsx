// src/components/game/ui/SettingsPanel.jsx
//
// In-game options overlay ([ESC]): device/player preferences persisted in
// localStorage via the settings store. Changes apply live - the Phaser
// systems read the store per-frame (or subscribe, for key rebinding).
import { useState } from 'react';
import { getSettings, updateSettings, resetSettings } from '../settings.js';
import { playSfx } from '../audio.js';

const OptionButtons = ({ options, value, onSelect }) => (
  <div className="flex gap-1.5">
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => onSelect(opt.value)}
        className={`font-mono text-[11px] tracking-wider px-3 py-1.5 border transition-colors ${
          value === opt.value
            ? 'border-accent text-accent'
            : 'border-line text-ink-dim hover:text-ink hover:border-line-bright'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const VolumeSlider = ({ value, onChange }) => (
  <div className="flex items-center gap-3">
    <input
      type="range"
      min="0"
      max="1"
      step="0.05"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={() => playSfx('uiClick')}
      className="w-36 accent-accent"
    />
    <span className="font-mono text-[12px] text-ink tabular-nums w-11 text-right">
      {Math.round(value * 100)}%
    </span>
  </div>
);

const SettingRow = ({ label, hint, children }) => (
  <div className="flex items-center justify-between gap-6 border-b border-line last:border-b-0 px-5 py-4">
    <div className="min-w-0">
      <div className="font-mono text-[13px] text-ink">{label}</div>
      {hint && <div className="font-mono text-[10px] text-ink-faint mt-0.5">{hint}</div>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

export const SettingsPanel = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState(getSettings());

  if (!isOpen) return null;

  const change = (patch) => setSettings({ ...updateSettings(patch) });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 backdrop-blur-sm">
      <div className="relative w-[90vw] max-w-xl bg-void border border-line overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-sans text-ink font-medium text-lg tracking-wide">Settings</h2>
            <p className="text-ink-faint text-[10px] font-mono tracking-wider uppercase">
              Saved on this device
            </p>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[11px] tracking-wider text-ink-dim hover:text-ink border border-line-bright hover:border-accent px-3 py-1.5 transition-colors"
          >
            CLOSE [ESC]
          </button>
        </div>

        <SettingRow label="Movement Keys" hint="Rotation, thrust and strafe cluster">
          <OptionButtons
            value={settings.keyboardLayout}
            onSelect={(v) => change({ keyboardLayout: v })}
            options={[
              { value: 'qwerty', label: 'QWERTY · WASD' },
              { value: 'azerty', label: 'AZERTY · ZQSD' },
            ]}
          />
        </SettingRow>

        <SettingRow label="Turn Sensitivity" hint="How sharply the ship responds to rotation input">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={settings.turnSensitivity}
              onChange={(e) => change({ turnSensitivity: Number(e.target.value) })}
              className="w-36 accent-accent"
            />
            <span className="font-mono text-[12px] text-ink tabular-nums w-11 text-right">
              {Math.round(settings.turnSensitivity * 100)}%
            </span>
          </div>
        </SettingRow>

        <SettingRow label="Camera Shake" hint="Boost rumble and impact feedback">
          <OptionButtons
            value={settings.cameraShake}
            onSelect={(v) => change({ cameraShake: v })}
            options={[
              { value: true, label: 'ON' },
              { value: false, label: 'OFF' },
            ]}
          />
        </SettingRow>

        <SettingRow label="Engine Trail" hint="Ship exhaust particle density">
          <OptionButtons
            value={settings.trailQuality}
            onSelect={(v) => change({ trailQuality: v })}
            options={[
              { value: 'off', label: 'OFF' },
              { value: 'low', label: 'LOW' },
              { value: 'high', label: 'HIGH' },
            ]}
          />
        </SettingRow>

        <SettingRow label="Master Volume" hint="Scales all game audio">
          <VolumeSlider
            value={settings.masterVolume}
            onChange={(v) => change({ masterVolume: v })}
          />
        </SettingRow>

        <SettingRow label="Effects Volume" hint="Scans, minigames, UI, engine hum">
          <VolumeSlider
            value={settings.sfxVolume}
            onChange={(v) => change({ sfxVolume: v })}
          />
        </SettingRow>

        <SettingRow label="Ambience Volume" hint="The deep-space drone">
          <VolumeSlider
            value={settings.ambientVolume}
            onChange={(v) => change({ ambientVolume: v })}
          />
        </SettingRow>

        <div className="flex justify-end px-5 py-3 border-t border-line">
          <button
            onClick={() => setSettings({ ...resetSettings() })}
            className="font-mono text-[10px] tracking-wider uppercase text-ink-faint hover:text-critical transition-colors"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
};
