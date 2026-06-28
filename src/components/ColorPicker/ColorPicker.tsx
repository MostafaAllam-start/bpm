import { useTranslation } from "react-i18next";
import "./ColorPicker.css";

const PRESETS = [
  "#000000", "#1f2937", "#374151", "#6b7280", "#9ca3af",
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6",
  "#8b5cf6", "#ec4899", "#ffffff",
];

interface ColorPickerProps {
  value: string | undefined;
  defaultColor?: string;
  onChange: (v: string | undefined) => void;
}

export default function ColorPicker({
  value,
  defaultColor = "#1f2937",
  onChange,
}: ColorPickerProps) {
  const { t } = useTranslation("form");
  const isTransparent = value === "transparent";
  const isCustom = !!value && !isTransparent && !PRESETS.includes(value);
  const effective = isCustom ? value : (isTransparent ? defaultColor : (value ?? defaultColor));

  return (
    <div className="cp-root">
      <div className="cp-swatches">
        <button
          type="button"
          className={`cp-swatch cp-swatch--transparent${isTransparent ? " cp-swatch--active" : ""}`}
          title={t("designer.props.transparentColor")}
          onClick={() => onChange("transparent")}
        />
        {PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            className={`cp-swatch${value === color ? " cp-swatch--active" : ""}`}
            style={{ backgroundColor: color }}
            title={color}
            onClick={() => onChange(color)}
          />
        ))}
        <label
          className={`cp-custom${isCustom ? " cp-swatch--active" : ""}`}
          title={t("designer.props.customColor")}
          style={isCustom ? { backgroundColor: value } : undefined}
        >
          <input
            type="color"
            className="cp-custom-input"
            value={effective}
            onChange={(e) => onChange(e.target.value)}
          />
          {!isCustom && <span className="cp-custom-icon" aria-hidden="true" />}
        </label>
      </div>
      {value && (
        <button type="button" className="cp-clear" onClick={() => onChange(undefined)}>
          {t("designer.title.resetColor")}
        </button>
      )}
    </div>
  );
}
