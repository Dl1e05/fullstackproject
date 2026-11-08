import Icon from './Icon.jsx';

export default function SearchInput({ value, onChange, placeholder = 'Поиск курсов и уроков', autoFocus, inputRef }) {
  return (
    <label className="search">
      <Icon name="search" size={20} className="search__icon" />
      <input
        ref={inputRef}
        type="search"
        className="search__input"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
        enterKeyHint="search"
      />
      {value && (
        <button type="button" className="search__clear" onClick={() => onChange('')} aria-label="Очистить поиск">
          <Icon name="x" size={18} />
        </button>
      )}
    </label>
  );
}
