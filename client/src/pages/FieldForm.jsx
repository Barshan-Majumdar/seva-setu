import {
  MapPin, Send, Users, Activity, AlertTriangle,
  CheckCircle2, Crosshair, Loader2, Heart, Flame
} from 'lucide-react';
import { useFieldForm } from '../hooks/useFieldForm';
import MainLayout from '../layouts/MainLayout';

const NEED_TYPES = [
  { value: 'medical',   label: 'Medical',   icon: Heart,          color: 'text-accent-rose' },
  { value: 'food',      label: 'Food',       icon: Flame,          color: 'text-accent-amber' },
  { value: 'shelter',   label: 'Shelter',    icon: MapPin,         color: 'text-accent-indigo' },
  { value: 'education', label: 'Education',  icon: Users,          color: 'text-accent-sky' },
  { value: 'other',     label: 'Other',      icon: AlertTriangle,  color: 'text-accent-green' },
];

const FieldForm = () => {
  const {
    formData, loading, locLoading, success, error,
    updateField, resetForm, getLocation, submitForm,
  } = useFieldForm();

  /* ── Success ────────────────────────────────────────────────── */
  if (success) {
    return (
      <MainLayout>
        <div className="min-h-[70vh] flex items-center justify-center px-4">
          <div className="card p-12 max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-accent-green" />
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-3">Report Submitted</h2>
            <p className="text-sm text-text-secondary leading-relaxed mb-8">
              Your field report has been transmitted and is being scored for urgency.
              The nearest qualified responder will be notified shortly.
            </p>
            <button onClick={resetForm} className="btn-primary w-full py-3 text-sm">
              Submit Another Report
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  /* ── Form ───────────────────────────────────────────────────── */
  return (
    <MainLayout>
      <div className="py-12 px-4">
        <div className="max-w-2xl mx-auto">

          {/* Page header */}
          <div className="mb-10">
            <h1 className="text-2xl font-bold text-text-primary mb-1">Field Report</h1>
            <p className="text-sm text-text-muted">Intelligence Intake — Field Personnel System</p>
          </div>

          <form onSubmit={submitForm} className="space-y-8">

            {/* Error */}
            {error && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-accent-rose/10 border border-accent-rose/20 text-accent-rose text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* ── Need Type ──────────────────────────────────────────── */}
            <div className="card p-6">
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">
                Requirement Category
              </label>
              <div className="grid grid-cols-5 gap-2">
                {NEED_TYPES.map((type) => {
                  const active = formData.need_type === type.value;
                  return (
                    <button
                      type="button"
                      key={type.value}
                      onClick={() => updateField('need_type', type.value)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 ${
                        active
                          ? 'border-text-primary bg-surface-hover'
                          : 'border-border bg-surface-secondary hover:border-border-hover'
                      }`}
                    >
                      <type.icon className={`w-5 h-5 ${active ? 'text-text-primary' : type.color}`} />
                      <span className={`text-[10px] font-semibold ${active ? 'text-text-primary' : 'text-text-muted'}`}>
                        {type.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Core Details ───────────────────────────────────────── */}
            <div className="card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Send className="w-4 h-4 text-text-muted" />
                Core Incident Data
              </h2>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Report Headline *</label>
                <input
                  required
                  className="input-field"
                  placeholder="Summarize the immediate need..."
                  value={formData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Ward / Block</label>
                  <input
                    className="input-field"
                    placeholder="e.g. Ward 64"
                    value={formData.ward}
                    onChange={(e) => updateField('ward', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">District</label>
                  <input
                    className="input-field"
                    placeholder="e.g. Kolkata"
                    value={formData.district}
                    onChange={(e) => updateField('district', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">People Affected</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      type="number"
                      className="input-field pl-9"
                      placeholder="Approx. count"
                      value={formData.people_affected}
                      onChange={(e) => updateField('people_affected', e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => updateField('is_disaster_zone', !formData.is_disaster_zone)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${
                    formData.is_disaster_zone
                      ? 'border-accent-rose/40 bg-accent-rose/10 text-accent-rose'
                      : 'border-border bg-surface-secondary text-text-muted hover:border-border-hover'
                  }`}
                >
                  <AlertTriangle className={`w-4 h-4 shrink-0 ${formData.is_disaster_zone ? 'animate-pulse' : ''}`} />
                  <span className="text-xs font-semibold flex-1 text-left">Disaster Zone</span>
                  {/* Toggle pill */}
                  <div className={`w-8 h-5 rounded-full relative transition-colors ${formData.is_disaster_zone ? 'bg-accent-rose' : 'bg-surface-hover'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${formData.is_disaster_zone ? 'translate-x-3' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              </div>
            </div>

            {/* ── Deployment Intel ───────────────────────────────────── */}
            <div className="card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <MapPin className="w-4 h-4 text-text-muted" />
                Deployment Intelligence
              </h2>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Operational Brief</label>
                <textarea
                  className="input-field resize-none h-32"
                  placeholder="Describe situational constraints, resources required, hazard levels..."
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                />
              </div>

              {/* GPS capture */}
              <button
                type="button"
                onClick={getLocation}
                disabled={locLoading}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 border-dashed transition-all duration-300 ${
                  formData.lat
                    ? 'border-accent-green/40 bg-accent-green/5 text-accent-green'
                    : 'border-border text-text-muted hover:border-border-hover hover:text-text-secondary'
                }`}
              >
                {locLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : formData.lat ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Crosshair className="w-5 h-5" />
                )}
                <div className="text-left">
                  <div className="text-sm font-semibold">
                    {formData.lat ? 'Coordinates Captured' : 'Capture GPS Location'}
                  </div>
                  <div className="text-xs mt-0.5 opacity-60">
                    {formData.lat
                      ? `${formData.lat.toFixed(5)}, ${formData.lng.toFixed(5)}`
                      : 'Required for spatial matching'}
                  </div>
                </div>
              </button>
            </div>

            {/* ── Submit ─────────────────────────────────────────────── */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-4 text-sm font-semibold"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Transmit Report
                </>
              )}
            </button>

            <p className="text-center text-xs text-text-muted">
              Encrypted end-to-end · Precision Dispatch v2.4
            </p>

          </form>
        </div>
      </div>
    </MainLayout>
  );
};

export default FieldForm;
