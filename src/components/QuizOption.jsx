import Icon from './Icon.jsx';

// state: default | selected | correct | wrong
export default function QuizOption({ letter, children, state = 'default', disabled, onClick }) {
  let mark = letter;
  if (state === 'correct') mark = <Icon name="check" size={16} />;
  if (state === 'wrong') mark = <Icon name="x" size={16} />;

  return (
    <button
      type="button"
      className={`quiz-option quiz-option--${state}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === 'selected'}
    >
      <span className="quiz-option__letter">{mark}</span>
      <span className="quiz-option__text">{children}</span>
    </button>
  );
}
