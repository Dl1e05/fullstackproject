import Icon from './Icon.jsx';

export default function InfoBox({ title = 'Запоминаем главное', items, children }) {
  return (
    <aside className="infobox">
      <div className="infobox__title">
        <Icon name="sparkle" size={18} /> {title}
      </div>
      {items ? (
        <ul className="infobox__list">
          {items.map((it) => (
            <li key={it}>
              <Icon name="check" size={16} /> {it}
            </li>
          ))}
        </ul>
      ) : (
        children
      )}
    </aside>
  );
}
