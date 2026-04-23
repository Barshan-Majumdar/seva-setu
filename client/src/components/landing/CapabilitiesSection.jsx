import SectionIntro from './SectionIntro';
import { FEATURE_GROUPS } from './content';

const CapabilitiesSection = () => (
  <section className="landing-section">
    <div className="container-lg space-y-10">
      <SectionIntro
        eyebrow="Capabilities"
        title="Built as modular operations blocks, not a cluttered one-screen dump."
        description="Each capability is isolated and measurable, so teams can improve response quality without redesigning the whole workflow."
      />

      <div className="landing-feature-grid">
        {FEATURE_GROUPS.map((feature) => (
          <article key={feature.title} className="landing-feature-card">
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
            <ul>
              {feature.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default CapabilitiesSection;

