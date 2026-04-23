import {
  MapPin, Send, Users, AlertTriangle,
  CheckCircle2, Crosshair, Loader2, Wifi, WifiOff, Clock3
} from 'lucide-react';
import { useFieldForm } from '../hooks/useFieldForm';
import MainLayout from '../layouts/MainLayout';

const FieldForm = () => {
  const {
    formData,
    loading,
    locLoading,
    success,
    successMessage,
    error,
    isOnline,
    queuedCount,
    syncingQueue,
    urgencyPreview,
    updateField,
    resetForm,
    getLocation,
    submitForm,
  } = useFieldForm();

  if (success) {
    return (
      <MainLayout>
        <div className="min-h-[70vh] flex items-center justify-center px-4">
          <div className="card p-10 max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-accent-green" />
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-3">Report Captured</h2>
            <p className="text-sm text-text-secondary leading-relaxed mb-8">
              {successMessage || 'Your field report has been transmitted and is being scored for urgency.'}
            </p>
            <button onClick={resetForm} className="btn-primary w-full py-3 text-sm">
              Submit Another Report
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="py-8 px-4">
        <div className="max-w-xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-text-primary mb-2">Field Report</h1>
            <p className="text-sm text-text-muted">Mobile-first intake form for fast low-bandwidth reporting.</p>
          </div>

          <div className="mb-4 flex items-center gap-2 text-xs font-semibold">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 ${
                isOnline
                  ? 'border-accent-green/30 text-accent-green bg-accent-green/10'
                  : 'border-accent-amber/30 text-accent-amber bg-accent-amber/10'
              }`}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isOnline ? 'Online' : 'Offline'}
            </span>

            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-text-secondary">
              <Clock3 className="w-3.5 h-3.5" />
              Queue: {queuedCount}
            </span>

            {syncingQueue ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-accent-sky/30 text-accent-sky bg-accent-sky/10 px-3 py-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Syncing
              </span>
            ) : null}
          </div>

          <form onSubmit={submitForm} className="space-y-6">
            {error ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-accent-rose/10 border border-accent-rose/20 text-accent-rose text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            ) : null}

            <div className="card p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-1.5">
                  Need Type
                </label>
                <select
                  className="input-field"
                  value={formData.need_type}
                  onChange={(e) => updateField('need_type', e.target.value)}
                >
                  <option value="medical">Medical</option>
                  <option value="food">Food</option>
                  <option value="shelter">Shelter</option>
                  <option value="education">Education</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-1.5">Title *</label>
                <input
                  required
                  className="input-field"
                  placeholder="Summarize the immediate need"
                  value={formData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-1.5">Description</label>
                <textarea
                  className="input-field resize-none h-28"
                  placeholder="Add context for responders"
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-1.5">Ward</label>
                  <input
                    className="input-field"
                    placeholder="e.g. Ward 64"
                    value={formData.ward}
                    onChange={(e) => updateField('ward', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-1.5">District</label>
                  <input
                    className="input-field"
                    placeholder="e.g. Kolkata"
                    value={formData.district}
                    onChange={(e) => updateField('district', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-1.5">
                    People Affected
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      type="number"
                      className="input-field pl-9"
                      placeholder="Approx count"
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
                  <div className={`w-8 h-5 rounded-full relative transition-colors ${formData.is_disaster_zone ? 'bg-accent-rose' : 'bg-surface-hover'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${formData.is_disaster_zone ? 'translate-x-3' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              </div>

              <div className="rounded-xl border border-accent-sky/25 bg-accent-sky/10 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent-sky">Urgency Preview</p>
                <p className="text-lg font-bold text-text-primary mt-1">{urgencyPreview} / 10</p>
                <p className="text-xs text-text-secondary mt-1">Estimated score before submit based on type, people, time, and disaster mode.</p>
              </div>
            </div>

            <div className="card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <MapPin className="w-4 h-4 text-text-muted" />
                GPS Capture
              </h2>

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

              <input type="hidden" value={formData.lat || ''} readOnly />
              <input type="hidden" value={formData.lng || ''} readOnly />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-sm font-semibold">
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {isOnline ? 'Transmit Report' : 'Save for Offline Sync'}
                </>
              )}
            </button>

            <p className="text-center text-xs text-text-muted">
              Encrypted end-to-end � Offline queue enabled � Precision Dispatch v2.5
            </p>
          </form>
        </div>
      </div>
    </MainLayout>
  );
};

export default FieldForm;
