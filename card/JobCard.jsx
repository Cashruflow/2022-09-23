import "./job-card.css";

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11A2.99 2.99 0 1 0 15 5c0 .24.04.47.09.7L8.04 9.81a3 3 0 1 0 0 4.38l7.12 4.16c-.05.21-.08.43-.08.65A2.92 2.92 0 1 0 18 16.08z" />
  </svg>
);

const BookmarkIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
  </svg>
);

/**
 * Адаптивная карточка (вакансия / услуга / виджет). Перестраивается по ширине
 * своего контейнера, а не экрана, — см. job-card.css.
 * Все подписи вынесены в пропсы, чтобы карточку можно было использовать не только
 * для вакансий (например, «Настройка Директа» / «от 30 000 ₽» / «запуск за 3 дня»).
 */
export const JobCard = ({
  logo,
  company,
  level,
  role,
  location,
  isRemote = false,
  remoteLabel = "(Remote)",
  salary,
  salarySuffix = "/month",
  when,
  avatar,
  profileMatch,
  matchLabel = "profile match",
  saved = false,
  onShare,
  onSave,
  shareLabel = "Share",
  saveLabel = "Save",
  headingLevel = 3,
}) => {
  const Heading = `h${headingLevel}`;

  return (
    <article className="job-card">
      <div className="job-card__body">
        {logo && (
          <img className="job-card__logo" src={logo} alt="" width="92" height="92" />
        )}

        <div className="job-card__main">
          <p className="job-card__company">{company}</p>
          {level && <p className="job-card__level">{level}</p>}
          <Heading className="job-card__role">{role}</Heading>
          {(location || isRemote) && (
            <p className="job-card__location">
              {location}
              {isRemote && <em className="job-card__accent"> {remoteLabel}</em>}
            </p>
          )}
        </div>

        {(salary || when) && (
          <div className="job-card__details">
            {salary && (
              <span>
                {salary}
                {salarySuffix && <em className="job-card__muted">{salarySuffix}</em>}
              </span>
            )}
            {when && <span className="job-card__muted">{when}</span>}
          </div>
        )}

        <div className="job-card__footer">
          {profileMatch != null && (
            <div className="job-card__badge">
              {avatar && (
                <img className="job-card__avatar" src={avatar} alt="" width="40" height="40" />
              )}
              <p className="job-card__badge-text">
                <em className="job-card__accent">{profileMatch}%</em>
                <span className="job-card__badge-label"> {matchLabel}</span>
              </p>
            </div>
          )}
          {onShare && (
            <button type="button" className="job-card__btn" onClick={onShare} aria-label={shareLabel}>
              <ShareIcon />
            </button>
          )}
          {onSave && (
            <button
              type="button"
              className="job-card__btn"
              onClick={onSave}
              aria-label={saveLabel}
              aria-pressed={saved}
            >
              <BookmarkIcon />
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
