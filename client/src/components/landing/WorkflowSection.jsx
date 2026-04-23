import SectionIntro from './SectionIntro';
import { WORKFLOW_STEPS } from './content';

const WorkflowSection = () => (
  <section className="landing-section landing-section-muted">
    <div className="container-lg space-y-10">
      <SectionIntro
        eyebrow="Workflow"
        title="Clear transitions between teams, with no spacing chaos or information overlap."
      />

      <ol className="landing-timeline">
        {WORKFLOW_STEPS.map((item) => (
          <li key={item.step} className="landing-timeline-item">
            <span className="landing-step">{item.step}</span>
            <div>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

export default WorkflowSection;

