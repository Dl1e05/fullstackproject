import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import CourseCover from './CourseCover.jsx';
import Icon from './Icon.jsx';
import { formatPrice } from '../services/api.js';

// Демо-оформление покупки: реальная оплата появится вместе с бэкендом и платёжным провайдером
export default function PurchaseModal({ course, onClose, onConfirm }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [status, setStatus] = useState('idle'); // idle | paying | done | error
  const [error, setError] = useState('');

  useEffect(() => {
    if (course) {
      setStatus('idle');
      setError('');
    }
  }, [course]);

  if (!course) return null;

  async function pay() {
    setStatus('paying');
    try {
      await onConfirm(course.id);
      setStatus('done');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }

  function start() {
    onClose();
    // уже внутри урока или теста этого курса — просто закрываем окно, контент откроется на месте
    if (!pathname.startsWith(`/courses/${course.id}/`)) navigate(`/courses/${course.id}`);
  }

  return (
    <Modal open onClose={onClose} title={status === 'done' ? 'Курс открыт!' : 'Покупка курса'} size="sm">
      {status === 'done' ? (
        <div className="purchase purchase--done">
          <span className="empty__icon">
            <Icon name="check" size={32} />
          </span>
          <p>
            Курс «{course.title}» добавлен в ваш аккаунт. Все уроки и итоговый тест теперь доступны.
          </p>
          <Button size="lg" block onClick={start}>
            Начать обучение <Icon name="arrowRight" size={18} />
          </Button>
        </div>
      ) : (
        <div className="purchase">
          <div className="purchase__course">
            <CourseCover topic={course.topic} size="sm" />
            <div>
              <strong>{course.title}</strong>
              <span className="muted">{course.subtitle}</span>
            </div>
          </div>
          <ul className="check-list">
            <li>
              <Icon name="check" size={18} /> {course.lessonsCount} уроков с практикой
            </li>
            <li>
              <Icon name="check" size={18} /> Итоговый тест
            </li>
            <li>
              <Icon name="check" size={18} /> Доступ навсегда, в том числе офлайн
            </li>
          </ul>
          <div className="purchase__total">
            <span>К оплате</span>
            <strong>{formatPrice(course.price)}</strong>
          </div>
          {status === 'error' && (
            <div className="feedback feedback--error" role="alert">
              <span>{error}</span>
            </div>
          )}
          <Button size="lg" block onClick={pay} disabled={status === 'paying'}>
            {status === 'paying' ? 'Обрабатываем оплату…' : `Оплатить ${formatPrice(course.price)}`}
          </Button>
          <p className="hint">Демо-режим: деньги не списываются, данные карты не запрашиваются.</p>
        </div>
      )}
    </Modal>
  );
}
