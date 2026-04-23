import { Link } from 'react-router-dom';
import { Show } from '@clerk/react';
import {
  ArrowRight, MapPin, Zap, Users, Shield,
  Activity, Globe, CheckCircle, Clock, Target
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

/* ─────────────────────────────────────────────────────────────── */
/* DATA                                                            */
/* ─────────────────────────────────────────────────────────────── */
const STATS = [
  { value: '3.3M+', label: 'NGOs in Network' },
  { value: '<5 min', label: 'Average Dispatch' },
  { value: '98%',   label: 'Match Accuracy' },
  { value: '10×',   label: 'Faster Response' },
];

const FEATURES = [
  {
    icon: MapPin,
    title: 'Geo-Spatial Intelligence',
    description: 'PostGIS proximity algorithms match resources to needs within a 500m radius, ensuring help arrives from the nearest available source.',
  },
  {
    icon: Zap,
    title: 'Dynamic Urgency Matrix',
    description: 'A scoring engine that factors impact severity, time-decay, and disaster-zone status to prioritise every incoming report automatically.',
  },
  {
    icon: Users,
    title: 'Elastic Volunteer Dispatch',
    description: 'Volunteers are matched by verified skill-sets, real-time availability, and historical performance — not just proximity.',
  },
  {
    icon: Activity,
    title: 'Live Pulse Monitoring',
    description: 'Full visibility from first report to verified resolution. Coordinators see every update in a single real-time feed.',
  },
  {
    icon: Globe,
    title: 'Offline-First Operations',
    description: 'Fully functional with zero connectivity. Background sync kicks in the moment a signal is available — no data is ever lost.',
  },
  {
    icon: Shield,
    title: 'Role-Based Access Control',
    description: 'Enterprise-grade RBAC separates coordinators, field workers, and volunteers with granular, auditable permission sets.',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: Target,
    title: 'Field worker files a report',
    description: 'Open the app, select a need category, describe the situation, and capture your GPS coordinates. Takes under 60 seconds.',
  },
  {
    step: '02',
    icon: Zap,
    title: 'AI scores and routes the need',
    description: 'Our urgency engine evaluates the report and instantly surfaces it to the closest qualified volunteers and NGOs.',
  },
  {
    step: '03',
    icon: Clock,
    title: 'Volunteer accepts and deploys',
    description: 'A matched volunteer accepts the request, gets turn-by-turn navigation, and keeps the coordinator updated in real-time.',
  },
  {
    step: '04',
    icon: CheckCircle,
    title: 'Verified resolution',
    description: 'Once complete, the field worker confirms delivery. The data feeds back into the system to improve future matching.',
  },
];

/* ─────────────────────────────────────────────────────────────── */
/* SECTIONS                                                        */
/* ─────────────────────────────────────────────────────────────── */

/** HERO */
const Hero = () => (
  <section className="py-24 lg:py-36 bg-surface-primary border-b border-border">
    <div className="container-lg">
      <div className="max-w-3xl">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-surface-card mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
          <span className="text-xs font-medium text-text-secondary">AI-Powered Aid Coordination</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl lg:text-6xl font-bold text-text-primary leading-tight tracking-tight mb-6">
          Mobilizing aid<br />
          <span className="text-text-secondary font-normal">at the speed of need.</span>
        </h1>

        {/* Sub */}
        <p className="text-lg text-text-secondary leading-relaxed max-w-xl mb-10">
          An intelligent geo-spatial platform that connects community needs 
          to volunteer resources in real-time — precision aid, delivered instantly.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center gap-4">
          <Show when="signed-out">
            <Link to="/sign-up" className="btn-primary text-base px-8 py-3.5">
              Start Coordinating
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Show>
          <Show when="signed-in">
            <Link to="/field" className="btn-primary text-base px-8 py-3.5">
              Enter Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Show>
          <a href="#features" className="btn-ghost text-base px-8 py-3.5">
            Explore Features
          </a>
        </div>

      </div>
    </div>
  </section>
);

/** STATS */
const Stats = () => (
  <section className="py-16 bg-surface-secondary border-b border-border">
    <div className="container-lg">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border">
        {STATS.map((s) => (
          <div key={s.label} className="bg-surface-secondary px-8 py-10 text-center">
            <div className="text-4xl font-bold text-text-primary mb-1">{s.value}</div>
            <div className="text-sm text-text-muted font-medium">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/** FEATURES */
const Features = () => (
  <section id="features" className="py-24 bg-surface-primary border-b border-border">
    <div className="container-lg">

      {/* Section header */}
      <div className="mb-16">
        <p className="section-label mb-3">Capabilities</p>
        <h2 className="text-3xl lg:text-4xl font-bold text-text-primary tracking-tight">
          Mission-critical tools,<br />built for the field.
        </h2>
      </div>

      {/* Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
        {FEATURES.map((f) => (
          <div key={f.title} className="card-hover p-8">
            <div className="w-10 h-10 rounded-xl bg-surface-hover flex items-center justify-center mb-6">
              <f.icon className="w-5 h-5 text-text-secondary" />
            </div>
            <h3 className="text-base font-semibold text-text-primary mb-3">{f.title}</h3>
            <p className="text-sm text-text-secondary leading-relaxed">{f.description}</p>
          </div>
        ))}
      </div>

    </div>
  </section>
);

/** HOW IT WORKS */
const HowItWorks = () => (
  <section className="py-24 bg-surface-secondary border-b border-border">
    <div className="container-lg">

      <div className="mb-16">
        <p className="section-label mb-3">Process</p>
        <h2 className="text-3xl lg:text-4xl font-bold text-text-primary tracking-tight">
          From report to resolution<br />in four steps.
        </h2>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {HOW_IT_WORKS.map((step, i) => (
          <div key={step.step} className="relative">
            {/* Connector line */}
            {i < HOW_IT_WORKS.length - 1 && (
              <div className="hidden lg:block absolute top-6 left-[calc(100%+12px)] w-full h-px bg-border z-10" />
            )}

            <div className="card p-6 h-full">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-surface-hover flex items-center justify-center">
                  <step.icon className="w-4 h-4 text-text-secondary" />
                </div>
                <span className="text-xs font-bold text-text-muted tabular-nums">{step.step}</span>
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">{step.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

    </div>
  </section>
);

/** CTA */
const CTA = () => (
  <section className="py-24 bg-surface-primary">
    <div className="container-lg">
      <div className="card p-12 lg:p-16 text-center">
        <h2 className="text-3xl lg:text-4xl font-bold text-text-primary tracking-tight mb-4">
          Ready to empower your community?
        </h2>
        <p className="text-base text-text-secondary max-w-lg mx-auto mb-10">
          Join thousands of NGOs and volunteers already coordinating faster, 
          smarter aid delivery across India.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link to="/sign-up" className="btn-primary text-base px-8 py-3.5">
            Join as Volunteer
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/sign-in" className="btn-ghost text-base px-8 py-3.5">
            NGO Registration
          </Link>
        </div>
      </div>
    </div>
  </section>
);

/* ─────────────────────────────────────────────────────────────── */
/* PAGE                                                            */
/* ─────────────────────────────────────────────────────────────── */
const LandingPage = () => (
  <MainLayout>
    <Hero />
    <Stats />
    <Features />
    <HowItWorks />
    <CTA />
  </MainLayout>
);

export default LandingPage;
