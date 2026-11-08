import EmptyState from '../components/EmptyState.jsx';
import Button from '../components/Button.jsx';

export default function NotFound() {
  return (
    <div className="container page">
      <EmptyState code="404" title="Страница не найдена" text="Возможно, ссылка устарела или в адресе опечатка.">
        <Button to="/">На главную</Button>
        <Button variant="outline" to="/catalog">
          Открыть каталог
        </Button>
      </EmptyState>
    </div>
  );
}
