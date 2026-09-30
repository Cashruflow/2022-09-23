# Правила адаптивной карточки (ПК → мобильный)

Адаптивная карточка перестраивается не по ширине экрана, а по ширине своего контейнера с помощью container queries. Все стили изолированы префиксом `.job-card` и настраиваются через CSS-токены. Карточка корректно работает на лендинге, в узкой колонке, сайдбаре или виджете платформы. Здесь собраны все правила, которые гарантируют, что карточка останется рабочей и доступной на любом устройстве.

**Связанные файлы:** [devices.md](devices.md) · [checklist.md](checklist.md) · [patterns/](patterns/)

## Изоляция стилей

### 1. Все стили должны быть под префиксом `.job-card` или его дочерних классов

**Почему:** Глобальные селекторы типа `em`, `h2`–`h5`, `:is(h2,h3,h4,h5)` меняют все заголовки и курсив на лендинге. Это создаёт конфликты с Bootstrap, Tilda, темой сайта.

**Плохо:**
```css
em {
  font-style: normal;
  color: var(--color-primary);
}

:is(h2, h3, h4, h5) {
  font-weight: 400;
  margin: 0;
}
```

**Хорошо:**
```css
.job-card__accent {
  font-style: normal;
  color: var(--jc-color-primary);
}

.job-card__company,
.job-card__level,
.job-card__role,
.job-card__location,
.job-card__badge-text {
  margin: 0;
  font-weight: 400;
}
```

### 2. Используйте названия классов по БЭМ с префиксом `job-card`, избегайте общих имён

**Почему:** Классы `.card`, `.main`, `.footer`, `.badge`, `.details` конфликтуют с CSS фреймворков и стилей сайта. Специфичный префикс гарантирует, что карточка не сломает стили соседних элементов.

**Плохо:**
```html
<div class="card">
  <div class="main">
    <div class="footer">
      <div class="badge">
```

**Хорошо:**
```html
<div class="job-card">
  <div class="job-card__main">
    <div class="job-card__footer">
      <div class="job-card__badge">
```

## Адаптация (container queries, clamp, брейкпоинты)

### 3. Используйте `@container` вместо `@media` для адаптации по ширине карточки

**Почему:** `@media (width >= 430px)` считает ширину экрана, а не контейнера. В сайдбаре или узкой колонке на ПК карточка узкая, но медиа-запрос включит «широкий» режим, и вёрстка сломается.

**Плохо:**
```css
@media (width >= 430px) {
  .card > img {
    top: 20px;
    right: 20px;
  }
}
```

**Хорошо:**
```css
@container job-card (min-width: 340px) {
  .job-card__logo {
    top: 20px;
    right: 20px;
  }
}
```

### 4. Установите контейнер на корневой элемент карточки

**Почему:** Без объявления контейнера `@container` запросы внутри не будут работать. Контейнер должен быть именно на `.job-card`, а не на родителе.

**Плохо:**
```css
.card {
  width: 100%;
}

@media (min-width: 340px) {
  /* не сработает */
}
```

**Хорошо:**
```css
.job-card {
  container: job-card / inline-size;
  width: 100%;
  max-width: var(--jc-max-width);
}

@container job-card (min-width: 340px) {
  /* работает */
}
```

### 5. Используйте относительные единицы в `clamp()` для адаптации шрифта к ширине контейнера

**Почему:** `clamp(22px, 5.5vw, 26px)` привязана к ширине экрана, не контейнера. Единица `cqi` (container query inline-size) делает размер шрифта пропорциональным ширине карточки.

**Плохо:**
```css
h4 {
  font-size: clamp(22px, 5.5vw, 26px);
}
```

**Хорошо:**
```css
.job-card__role {
  font-size: clamp(22px, 7cqi, 26px);
}
```

### 6. Установите брейкпоинты карточки на 340px и 400px, не на размеры экрана

**Почему:** 340px — это ширина самой карточки, а не экрана: при меньшей ширине карточка в узком режиме. 400px — это точка, где в бейдже хватает места на подпись «profile match». Эти значения вычислены как эквиваленты оригинальных 430px экрана при `width: 80vw`.

**Плохо:**
```css
@media (min-width: 768px) {
  .card {
    /* ориентируется на размер экрана, не карточки */
  }
}
```

**Хорошо:**
```css
@container job-card (min-width: 340px) {
  .job-card__logo {
    width: clamp(68px, 16cqi, 80px);
  }
}

@container job-card (min-width: 400px) {
  .job-card__badge-label {
    display: inline;
  }
}
```

## Размеры и отступы

### 7. Оставьте `margin-top` на теле карточки в узком режиме для логотипа

**Почему:** Логотип позиционируется с `top: 0; translate: -50% -50%` и висит над карточкой наполовину. Без `margin-top` верх логотипа обрезается в контейнерах с `overflow: hidden` (слайдеры, модалки).

**Плохо:**
```css
.card {
  padding-top: 30px;
  /* логотип обрезается */
}
```

**Хорошо:**
```css
.job-card__body {
  margin-top: calc(var(--jc-logo-size) / 2);
  padding-top: 30px;
}

@container job-card (min-width: 340px) {
  .job-card__body {
    margin-top: 0;
    padding-top: 0;
  }
}
```

### 8. Используйте `width: 100%; max-width: var()` вместо `width: clamp()`

**Почему:** `width: clamp(200px, 80vw, 500px)` плохо ведёт себя в гридах и флекс-контейнерах: вылезает за границы ячейки или не растягивается на всю ширину. `width: 100%; max-width` позволяет карточке адаптироваться к контейнеру.

**Плохо:**
```css
.card {
  width: clamp(200px, 80vw, 500px);
}
```

**Хорошо:**
```css
.job-card {
  width: 100%;
  max-width: var(--jc-max-width);
}
```

## Изображения и CLS

### 9. Всегда указывайте `width`, `height` и `aspect-ratio` для изображений

**Почему:** Без размеров контент прыгает при загрузке изображения — это повышает CLS (Cumulative Layout Shift) в PageSpeed Insights. Браузер не может зарезервировать место заранее.

**Плохо:**
```html
<img class="logo" src="logo.svg">
```

**Хорошо:**
```html
<img className="job-card__logo" src={logo} alt="" width="92" height="92" />
```

### 10. Используйте `object-fit` для аватаров, чтобы они не растягивались

**Почему:** Аватар может приходить в разных пропорциях. `object-fit: cover` гарантирует, что изображение заполнит ровно 40×40px без деформации.

**Плохо:**
```css
.badge img {
  width: 40px;
  height: 40px;
}
```

**Хорошо:**
```css
.job-card__avatar {
  width: 40px;
  height: 40px;
  object-fit: cover;
}
```

## Кнопки и доступность

### 11. Используйте `type="button"` и `aria-label` на кнопках

**Почему:** Без `type` кнопка внутри `<form>` отправляет форму. Без `aria-label` скринридер читает содержимое иконки (например, «share» вместо «Поделиться»). Внешние шрифты Material Icon грузятся медленно, и пока они не загрузились, вместо иконки видно слово «bookmark».

**Плохо:**
```jsx
<button onClick={onSave}>
  <span className="material-symbols-outlined">bookmark</span>
</button>
```

**Хорошо:**
```jsx
<button type="button" className="job-card__btn" onClick={onSave} aria-label={saveLabel}>
  <BookmarkIcon />
</button>
```

### 12. Используйте `:focus-visible` для кнопок, чтобы виден фокус при клавиатурной навигации

**Почему:** Фокус нужен только при навигации с клавиатуры, а не при клике мышью. `:focus-visible` показывает контур только когда это нужно.

**Плохо:**
```css
.footer button:focus {
  outline: 2px solid blue;
}
```

**Хорошо:**
```css
.job-card__btn:focus-visible {
  outline: 2px solid var(--jc-color-primary);
  outline-offset: 2px;
}
```

### 13. Используйте `@media (hover: hover)` для `:hover` стилей, чтобы не было залипания на тачах

**Почему:** На тач-экранах `:hover` остаётся активным после тапа и выглядит как «залипший» фон. `@media (hover: hover)` применяет стиль только на устройствах с настоящей мышью.

**Плохо:**
```css
.footer button:hover {
  background: var(--color-highlight);
}
```

**Хорошо:**
```css
@media (hover: hover) {
  .job-card__btn:hover {
    background: var(--jc-color-highlight);
  }
}
```

## Тач-устройства

### 14. Кнопки не меньше 40px, для мобильных лендингов — 44px

**Почему:** 40px кнопки проходят WCAG 2.2 AA minimum (24×24px рекомендуемый минимум иконки), но Apple и Google рекомендуют 44–48px. Если лендинг в основном на мобильных — увеличьте `.job-card__btn` width/height до 44px.

**Плохо:** иконка-кнопка меньше 24px или без явных размеров.

**Хорошо:**
```css
.job-card__btn {
  width: 40px;
  height: 40px;
  padding: 0;
  display: grid;
  place-items: center;
}

/* Для мобильных лендингов: */
.job-card__btn {
  width: 44px;
  height: 44px;
}
```

### 15. Используйте `@media (prefers-reduced-motion: reduce)` для отключения анимаций

**Почему:** Пользователи с вестибулярными расстройствами или склонностью к укачиванию просят браузер минимизировать движение. Анимации переходов могут вызвать дискомфорт.

**Плохо:**
```css
.footer button {
  transition: background 0.2s;
}
```

**Хорошо:**
```css
.job-card__btn {
  transition: background 0.2s;
}

@media (prefers-reduced-motion: reduce) {
  .job-card__btn {
    transition: none;
  }
}
```

## Типографика и переносы

### 16. Используйте `overflow-wrap: anywhere` для длинных текстов, чтобы они не ломали карточку

**Почему:** Длинное название должности или услуги (например, «Специалист по настройке холодного завёртывания холодного контента») распирает карточку на мобильнике. `overflow-wrap: anywhere` переносит слова на новую строку.

**Плохо:**
```css
h4 {
  /* длинный текст вылезает за границы */
}
```

**Хорошо:**
```css
.job-card__role {
  overflow-wrap: anywhere;
  line-height: 1.2;
}
```

### 17. Используйте `flex-wrap: wrap` в строке деталей для переноса элементов

**Почему:** На узких карточках зарплата и сроки должны переноситься на новую строку, а не висеть на одной строке и обрезаться.

**Плохо:**
```css
.details {
  display: flex;
  justify-content: space-between;
}
```

**Хорошо:**
```css
.job-card__details {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 12px;
}
```

### 18. Используйте `text-overflow: ellipsis` в бейдже, чтобы длинный текст не ломал макет

**Почему:** Если подпись в бейдже длиннее, чем место, она должна скрываться многоточием, а не растягиваться.

**Плохо:**
```css
.badge p {
  color: var(--color-muted);
}
```

**Хорошо:**
```css
.job-card__badge-text {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

## Токены и брендирование

### 19. Определите все цвета как CSS-переменные (токены) с префиксом `--jc-`

**Почему:** Без токенов пришлось бы править CSS для каждого бренда. С токенами брендирование — это одна блокировка стилей на лендинге или в коде компонента.

**Плохо:**
```css
.card {
  color: #202124;
  background: #ffffff;
  border: 1px solid #dadce0;
}
```

**Хорошо:**
```css
.job-card {
  --jc-color-primary: #1a73e8;
  --jc-color-text: #202124;
  --jc-color-muted: #5f6368;
  --jc-color-highlight: #f1f3f4;
  --jc-color-bg: #ffffff;
  --jc-border: 1px solid #dadce0;
  --jc-radius: 24px;
  --jc-shadow: 0 1px 3px rgb(60 64 67 / 15%);
}
```

### 20. Передавайте логотип пропсом, а не жёстко в компонент

**Почему:** Если логотип зашит в React-компоненте, все карточки будут с одним и тем же логотипом. Пропс позволяет переиспользовать карточку для разных сервисов.

**Плохо:**
```jsx
import logo from "./logo.svg";

export const Card = () => {
  return <img src={logo} alt={company} />;
};
```

**Хорошо:**
```jsx
export const JobCard = ({ logo, company, ... }) => {
  return (
    <article className="job-card">
      {logo && (
        <img className="job-card__logo" src={logo} alt="" width="92" height="92" />
      )}
      {/* ... */}
    </article>
  );
};
```

### 21. Наследуйте шрифт от сайта, не зашивайте его в карточку

**Почему:** Оригинал не устанавливает `font-family` вообще — карточка молча использует шрифт страницы. Если зашить шрифт (например, `Poppins`, `Roboto`), придётся грузить доп. CSS/CDN для каждого лендинга. `inherit` позволяет карточке адаптироваться к любому дизайну.

**Плохо:** жёстко кодировать `font-family: "Poppins", sans-serif` в CSS карточки.

**Хорошо:**
```css
.job-card {
  /* font-family не указана, наследуется от body */
  font-family: var(--jc-font);
}
```
На лендинге переопределить при необходимости:
```css
.job-card {
  --jc-font: inherit; /* или "Poppins", sans-serif на конкретном лендинге */
}
```

## Совместимость браузеров

### 22. Container queries поддерживаются в Chrome/Edge 105+, Safari 16+ и Firefox 110+

**Почему:** В старых браузерах `@container` не работает, и карточка остаётся в узком режиме (логотип по центру). Это не ломает макет, а просто не применяются адаптивные стили.

**Плохо:** Полагаться на `@media (width >= ...)` для старых браузеров.

**Хорошо:** Использовать `@container` — старые браузеры просто не применят эти правила, и карточка останется функциональной в узком режиме.

### 23. Карточка работает без JavaScript

**Почему:** HTML-версия (из `demo.html`) должна быть полностью функциональна без React. Базовая разметка и стили достаточны, React добавляет интерактивность (как пропсы `onShare`, `onSave`).

**Плохо:** Карточка зависит от скрипта для отображения сетки или логотипа.

**Хорошо:** Статическая HTML-разметка показывает карточку целиком (логотип, компания, роль, бейдж, кнопки), кнопки пустые или просто тегами `<button>` без обработчиков. React потом добавляет состояние и обработчики.
