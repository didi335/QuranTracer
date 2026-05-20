import { Slider } from "@/components/ui/slider";
import { PenSettings } from "@/hooks/useCanvas";

const PRESET_COLORS = [
  "#1a1a2e", "#16213e", "#0f3460", "#1b4332",
  "#7b2d8b", "#c0392b", "#e67e22", "#2980b9",
  "#27ae60", "#8e44ad", "#2c3e50", "#ffffff",
];

interface ToolbarProps {
  penSettings: PenSettings;
  onPenChange: (settings: Partial<PenSettings>) => void;
  textOpacity: number;
  textStageLabel: string;
  onCycleTextStage: () => void;
  onUndo: () => void;
  onClear: () => void;
  onDownload: () => void;
  isDark: boolean;
  onToggleDark: () => void;
  compact?: boolean;
}

export function Toolbar({
  penSettings,
  onPenChange,
  textOpacity,
  textStageLabel,
  onCycleTextStage,
  onUndo,
  onClear,
  onDownload,
  isDark,
  onToggleDark,
  compact,
}: ToolbarProps) {
  const textHidden = textOpacity === 0;
  const textFull   = textOpacity >= 1;
  const mutedText = isDark ? "text-[#a0a0c0]" : "text-[#7f8c8d]";
  const accentColor = isDark ? "#d4af37" : "#1a5276";
  const dividerColor = isDark ? "#2a2a4e" : "#e8e3d5";
  const btnBase = isDark
    ? "bg-[#2a2a4e] text-[#c0c0e0] hover:bg-[#3a3a5e]"
    : "bg-[#f0ece0] text-[#1a1a2e] hover:bg-[#e0dcc0]";

  const inner = (
    <div className="flex flex-col gap-5 w-full">

      {/* Tool selector */}
      <div>
        <label className={`text-xs font-semibold uppercase tracking-wider mb-2 block ${mutedText}`}>Tool</label>
        <div className="flex gap-2">
          <button
            onClick={() => onPenChange({ mode: "pen" })}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{
              background: penSettings.mode === "pen" ? accentColor : (isDark ? "#2a2a4e" : "#f0ece0"),
              color:      penSettings.mode === "pen" ? "#fff" : (isDark ? "#c0c0e0" : "#1a1a2e"),
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6.293-6.293a1 1 0 011.414 0l2.586 2.586a1 1 0 010 1.414L13 15H9v-4z" />
            </svg>
            Pen
          </button>
          <button
            onClick={() => onPenChange({ mode: "eraser" })}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{
              background: penSettings.mode === "eraser" ? accentColor : (isDark ? "#2a2a4e" : "#f0ece0"),
              color:      penSettings.mode === "eraser" ? "#fff" : (isDark ? "#c0c0e0" : "#1a1a2e"),
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.24 3.56l4.2 4.2a2 2 0 010 2.83l-9.19 9.19a2 2 0 01-2.83 0l-4.2-4.2a2 2 0 010-2.83l9.19-9.19a2 2 0 012.83 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 21h12M9.5 9.5l5 5" />
            </svg>
            Eraser
          </button>
        </div>
      </div>

      {/* Color (pen only) */}
      {penSettings.mode !== "eraser" && (
      <div>
        <label className={`text-xs font-semibold uppercase tracking-wider mb-2 block ${mutedText}`}>Color</label>
        <div className="grid grid-cols-6 gap-1.5 mb-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onPenChange({ color: c })}
              className="rounded-full aspect-square transition-transform active:scale-90"
              style={{
                backgroundColor: c,
                border: penSettings.color === c
                  ? `3px solid ${accentColor}`
                  : `2px solid ${isDark ? "#3a3a5e" : "#d0ccc0"}`,
                width: "100%",
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className={`text-xs ${mutedText}`}>Custom:</label>
          <input
            type="color"
            value={penSettings.color}
            onChange={(e) => onPenChange({ color: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
          />
          <span className="text-xs font-mono">{penSettings.color}</span>
        </div>
      </div>
      )}

      {/* Thickness */}
      <div>
        <label className={`text-xs font-semibold uppercase tracking-wider mb-2 block ${mutedText}`}>
          Thickness — {penSettings.thickness}px
        </label>
        <Slider
          min={1} max={40} step={1}
          value={[penSettings.thickness]}
          onValueChange={([v]) => onPenChange({ thickness: v })}
          className="w-full"
        />
        <div className="flex justify-between text-xs mt-1 opacity-50">
          <span>Fine</span><span>Thick</span>
        </div>
      </div>

      {/* Opacity */}
      <div>
        <label className={`text-xs font-semibold uppercase tracking-wider mb-2 block ${mutedText}`}>
          Opacity — {Math.round(penSettings.opacity * 100)}%
        </label>
        <Slider
          min={5} max={100} step={5}
          value={[Math.round(penSettings.opacity * 100)]}
          onValueChange={([v]) => onPenChange({ opacity: v / 100 })}
          className="w-full"
        />
        <div className="flex justify-between text-xs mt-1 opacity-50">
          <span>Faint</span><span>Solid</span>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t pt-4" style={{ borderColor: dividerColor }}>
        <label className={`text-xs font-semibold uppercase tracking-wider mb-3 block ${mutedText}`}>Actions</label>
        <div className="flex flex-col gap-2">
          <button
            onClick={onCycleTextStage}
            title="Cycle: Trace → Faded → Memory"
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 ${
              textFull
                ? isDark ? "bg-[#d4af37] text-[#1a1a2e]" : "bg-[#1a5276] text-white"
                : btnBase
            }`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {textHidden
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              }
            </svg>
            <span className="flex-1 text-left">Memorize: {textStageLabel}</span>
            <span className="text-xs opacity-60">{textFull ? "1/3" : textHidden ? "3/3" : "2/3"}</span>
          </button>

          <button onClick={onUndo} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 ${btnBase}`}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Undo
          </button>

          <button
            onClick={onToggleDark}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 ${btnBase}`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isDark
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              }
            </svg>
            {isDark ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </div>
    </div>
  );

  if (compact) return inner;

  return (
    <div
      className={`flex flex-col gap-4 p-4 rounded-2xl shadow-lg border ${
        isDark ? "bg-[#1a1a2e] border-[#2a2a4e] text-white" : "bg-white border-[#e8e3d5] text-[#1a1a2e]"
      }`}
      style={{ width: "clamp(220px, 22vw, 280px)", minWidth: 220 }}
    >
      <div className="text-center">
        <h2 className={`font-bold text-base tracking-wide ${isDark ? "text-[#d4af37]" : "text-[#1a5276]"}`}>
          Quran Tracer
        </h2>
        <p className={`text-xs mt-0.5 ${mutedText}`}>Pen Settings</p>
      </div>
      {inner}
    </div>
  );
}
