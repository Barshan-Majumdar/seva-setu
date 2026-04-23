const SectionIntro = ({ eyebrow, title, description }) => (
  <header className="max-w-3xl">
    <p className="landing-eyebrow">{eyebrow}</p>
    <h2 className="landing-heading">{title}</h2>
    {description ? <p className="landing-subcopy">{description}</p> : null}
  </header>
);

export default SectionIntro;

