export default function ProgressBar({ value = 0, label, showValue = false, size = 'md' }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`progress progress--${size}`}>
      {(label || showValue) && (
        <div className="progress__head">
          {label && <span>{label}</span>}
          {showValue && <span className="progress__value">{v}%</span>}
        </div>
      )}
      <div
        className="progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        aria-label={label ?? 'Прогресс'}
      >
        <div className="progress__fill" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
