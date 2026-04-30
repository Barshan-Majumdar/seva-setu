import React, { useState, useRef } from 'react';
import {
  MapPin, Send, Users, AlertTriangle,
  CheckCircle2, Crosshair, Loader2, Clock3, Camera, X,
  Navigation, ShieldCheck, Heart, Utensils, Home, Anchor, Package, Upload,
  MessageCircle, Copy, Check, ExternalLink
} from 'lucide-react';
import { useFieldForm } from '../hooks/useFieldForm';
import MainLayout from '../layouts/MainLayout';
import CameraWatermark from '../components/CameraWatermark';

const TWILIO_WHATSAPP_NUMBER = import.meta.env.VITE_TWILIO_WHATSAPP_NUMBER ;
const TWILIO_SANDBOX_CODE = import.meta.env.VITE_TWILIO_SANDBOX_CODE ;

const FieldForm = () => {
  const [showCamera, setShowCamera] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const galleryInputRef = useRef(null);
  const {
    formData, loading, locLoading, success, successMessage,
    error, isOnline, queuedCount, syncingQueue, urgencyPreview,
    updateField, resetForm, getLocation, setManualLocation, submitForm,
  } = useFieldForm();

  /* ── Success screen ─────────────────────────────────────── */
  if (success) {
    return (
      <MainLayout>
        <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: '#f8fafc' }}>
          <div className="card" style={{ padding: '2.5rem', maxWidth: '28rem', width: '100%', textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16, background: 'rgba(5, 150, 105, 0.08)',
              border: '1px solid rgba(5, 150, 105, 0.2)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 1.5rem',
            }}>
              <CheckCircle2 style={{ width: 32, height: 32, color: '#059669' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f171d', marginBottom: '0.75rem' }}>
              Report Submitted
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.7, marginBottom: '2rem' }}>
              {successMessage || 'Your field report has been transmitted and is being scored for urgency.'}
            </p>
            <button onClick={resetForm} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.85rem' }}>
              Submit Another Report
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const errorLines = error ? error.split('\n').filter(Boolean) : [];

  /* ── helpers ────────────────────────────────────────────── */
  const fieldStyle = {
    width: '100%',
    background: '#f8fafc',
    border: '1px solid rgba(15, 23, 29, 0.1)',
    color: '#0f171d',
    borderRadius: 12,
    padding: '0.85rem 1.1rem',
    fontSize: '0.9375rem',
    outline: 'none',
    fontFamily: 'inherit',
  };

  const fieldIconStyle = {
    ...fieldStyle,
    paddingLeft: '3rem',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.65rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: '#64748b',
    marginBottom: '0.5rem',
  };

  return (
    <MainLayout>
      <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBlock: 'clamp(2rem, 3vw, 3.5rem)' }}>
        <div className="container-narrow">

          {/* ── Page header ─────────────────────────────── */}
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <h1 style={{
              fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 900,
              color: '#0f171d', letterSpacing: '-0.02em', marginBottom: '0.75rem',
            }}>
              Field Report
            </h1>
            <p style={{ fontSize: '1rem', color: '#475569', maxWidth: '36rem', margin: '0 auto' }}>
              Submit a structured community need with location and evidence for rapid coordinator review.
            </p>
          </div>

          {/* ── Status bar ──────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.4rem 1rem', borderRadius: 9999, fontSize: '0.72rem',
              fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              background: isOnline ? 'rgba(5, 150, 105, 0.06)' : 'rgba(217, 119, 6, 0.06)',
              color: isOnline ? '#059669' : '#d97706',
              border: `1px solid ${isOnline ? 'rgba(5, 150, 105, 0.2)' : 'rgba(217, 119, 6, 0.2)'}`,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: isOnline ? '#059669' : '#d97706', display: 'inline-block' }} />
              {isOnline ? 'Online' : 'Offline Mode'}
            </span>

            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.4rem 1rem', borderRadius: 9999, fontSize: '0.72rem',
              fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              background: '#f1f5f9', color: '#475569',
              border: '1px solid rgba(15, 23, 29, 0.08)',
            }}>
              <Clock3 style={{ width: 14, height: 14 }} />
              Queue: {queuedCount}
            </span>
          </div>

          <form onSubmit={submitForm} style={{ display: 'grid', gap: '1.25rem' }}>

            {/* ── Error panel ─────────────────────────── */}
            {errorLines.length > 0 && (
              <div className="card" style={{ padding: '1.25rem', borderColor: 'rgba(195, 93, 81, 0.2)', background: 'rgba(195, 93, 81, 0.03)' }}>
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ background: 'rgba(195, 93, 81, 0.1)', padding: '0.4rem', borderRadius: '0.5rem', height: 'fit-content' }}>
                    <AlertTriangle style={{ width: 18, height: 18, color: '#c35d51', flexShrink: 0 }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#c35d51', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Verification Rejected</p>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>{errorLines.length} issue(s) detected</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {errorLines.map((line, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', padding: '0.6rem 0.75rem', borderRadius: '0.5rem', background: '#f8fafc', border: '1px solid rgba(15, 23, 29, 0.06)' }}>
                      <span style={{ color: '#c35d51', fontWeight: 800, fontSize: '0.75rem', flexShrink: 0 }}>{idx + 1}.</span>
                      <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.5 }}>{line}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Core details card ───────────────────── */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 4, height: 16, background: '#2d6148', borderRadius: 9999, display: 'inline-block' }} />
                Incident Details
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                  <label style={labelStyle}>Need Classification</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                    {[
                      { value: 'medical',    label: 'Medical',   Icon: Heart },
                      { value: 'accidental', label: 'Accident',  Icon: AlertTriangle },
                      { value: 'food',       label: 'Food & Water', Icon: Utensils },
                      { value: 'shelter',    label: 'Shelter',   Icon: Home },
                      { value: 'rescue',     label: 'Rescue',    Icon: Anchor },
                      { value: 'other',      label: 'General',   Icon: Package },
                    ].map(({ value, label, Icon }) => {
                      const isSelected = formData.need_type === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => updateField('need_type', value)}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', gap: '0.35rem', padding: '0.7rem 0.4rem',
                            borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s',
                            border: `1.5px solid ${isSelected ? 'rgba(45, 97, 72, 0.35)' : 'rgba(15, 23, 29, 0.1)'}`,
                            background: isSelected ? 'rgba(45, 97, 72, 0.08)' : '#f8fafc',
                            color: isSelected ? '#2d6148' : '#64748b',
                          }}
                        >
                          <Icon style={{ width: 18, height: 18 }} />
                          <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>People Affected (approx.)</label>
                  <div style={{ position: 'relative' }}>
                    <Users style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#94a3b8' }} />
                    <input
                      type="number"
                      style={fieldIconStyle}
                      placeholder="Estimated headcount"
                      value={formData.people_affected}
                      onChange={(e) => updateField('people_affected', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={labelStyle}>District *</label>
                  <div style={{ position: 'relative' }}>
                    <MapPin style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#94a3b8' }} />
                    <input
                      required
                      style={fieldIconStyle}
                      placeholder="e.g. South 24 Parganas"
                      value={formData.district}
                      onChange={(e) => updateField('district', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Area / Ward *</label>
                  <div style={{ position: 'relative' }}>
                    <Navigation style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#94a3b8' }} />
                    <input
                      required
                      style={fieldIconStyle}
                      placeholder="e.g. Ward 102"
                      value={formData.ward}
                      onChange={(e) => updateField('ward', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Contact Number (WhatsApp / Call)</label>
                <input
                  type="tel"
                  style={fieldStyle}
                  placeholder="+91 9876543210"
                  value={formData.contact_number || ''}
                  onChange={(e) => updateField('contact_number', e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Headline *</label>
                <input
                  required
                  style={fieldStyle}
                  placeholder="Briefly describe the crisis"
                  value={formData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Details</label>
                <textarea
                  style={{ ...fieldStyle, height: 120, resize: 'vertical' }}
                  placeholder="Provide specific context for rapid response..."
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                />
              </div>

              {/* Priority + Disaster mode */}
              <div className="field-priority-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ background: 'rgba(45, 97, 72, 0.04)', border: '1px solid rgba(45, 97, 72, 0.12)', borderRadius: 12, padding: '1rem' }}>
                  <p style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#2d6148' }}>Priority Index</p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 900, color: '#0f171d' }}>{urgencyPreview}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>/ 10</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => updateField('is_disaster_zone', !formData.is_disaster_zone)}
                  style={{
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                    gap: '0.35rem', borderRadius: 12, cursor: 'pointer', transition: 'all 0.25s',
                    background: formData.is_disaster_zone ? 'rgba(195, 93, 81, 0.08)' : '#f8fafc',
                    border: `1px solid ${formData.is_disaster_zone ? 'rgba(195, 93, 81, 0.3)' : 'rgba(15, 23, 29, 0.1)'}`,
                    color: formData.is_disaster_zone ? '#c35d51' : '#94a3b8',
                  }}
                >
                  <AlertTriangle style={{ width: 20, height: 20 }} />
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Disaster Mode</span>
                </button>
              </div>
            </div>

            {/* ── Verification layer ───────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>

              {/* Visual evidence */}
              <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 220 }}>
                <div>
                  <h2 style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ width: 4, height: 14, background: '#2d6148', borderRadius: 9999, display: 'inline-block' }} />
                    Visual Evidence
                  </h2>
                  <p style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.2rem' }}>Live Capture or Gallery Upload</p>
                </div>

                {formData.imageFile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden', background: '#f1f5f9', border: '1px solid rgba(45, 97, 72, 0.2)' }}>
                      <img src={URL.createObjectURL(formData.imageFile)} alt="Captured evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', top: 8, left: 8, padding: '3px 10px', borderRadius: 6, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(5, 150, 105, 0.15)', color: '#059669', border: '1px solid rgba(5, 150, 105, 0.25)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Navigation style={{ width: 11, height: 11 }} /> Geo-tagged
                      </div>
                      <button type="button" onClick={() => updateField('imageFile', null)} style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: 'rgba(15, 23, 29, 0.5)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <X style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ShieldCheck style={{ width: 14, height: 14, color: '#059669', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formData.imageFile.name}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {/* Option 1: Live Camera */}
                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                        padding: '1.15rem', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
                        border: '2px dashed rgba(45, 97, 72, 0.3)', background: 'rgba(45, 97, 72, 0.03)',
                        color: '#2d6148',
                      }}
                    >
                      <Camera style={{ width: 22, height: 22 }} />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Live GPS Camera</div>
                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>Recommended · Anti-Fraud</div>
                      </div>
                    </button>

                    {/* Divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ flex: 1, height: 1, background: 'rgba(15, 23, 29, 0.08)' }} />
                      <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>or</span>
                      <div style={{ flex: 1, height: 1, background: 'rgba(15, 23, 29, 0.08)' }} />
                    </div>

                    {/* Option 2: Gallery Upload */}
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          updateField('imageFile', e.target.files[0]);
                        }
                        e.target.value = ''; // reset so same file can be re-selected
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                        padding: '1.15rem', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
                        border: '2px dashed rgba(71, 85, 105, 0.2)', background: 'rgba(71, 85, 105, 0.02)',
                        color: '#475569',
                      }}
                    >
                      <Upload style={{ width: 20, height: 20 }} />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Upload from Gallery</div>
                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>Choose a file from your device</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* GPS capture */}
              <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 220 }}>
                <div>
                  <h2 style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ width: 4, height: 14, background: '#475569', borderRadius: 9999, display: 'inline-block' }} />
                    Spatial Identity
                  </h2>
                  <p style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.2rem' }}>GPS Metadata</p>
                </div>

                <button
                  type="button"
                  onClick={getLocation}
                  disabled={locLoading}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '0.75rem', padding: '1.25rem', borderRadius: 12, cursor: locLoading ? 'wait' : 'pointer',
                    border: `2px dashed ${formData.lat ? 'rgba(45, 97, 72, 0.3)' : 'rgba(15, 23, 29, 0.1)'}`,
                    background: formData.lat ? 'rgba(45, 97, 72, 0.04)' : '#f8fafc',
                    color: formData.lat ? '#2d6148' : '#94a3b8',
                    transition: 'all 0.25s',
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: formData.lat ? 'rgba(45, 97, 72, 0.08)' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(15, 23, 29, 0.08)' }}>
                    {locLoading ? <Loader2 style={{ width: 20, height: 20 }} className="animate-spin" /> : formData.lat ? <CheckCircle2 style={{ width: 20, height: 20 }} /> : <Crosshair style={{ width: 20, height: 20 }} />}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{formData.lat ? 'Location Locked' : 'Capture Location'}</div>
                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.65, marginTop: 2 }}>
                      {formData.lat ? `${formData.lat.toFixed(4)}, ${formData.lng.toFixed(4)}` : 'Required'}
                    </div>
                  </div>
                </button>

                {!formData.lat && !locLoading && (
                  <button
                    type="button"
                    onClick={() => {
                      const lat = prompt("Enter Latitude:", "22.5726");
                      const lng = prompt("Enter Longitude:", "88.3639");
                      if (lat && lng) setManualLocation(parseFloat(lat), parseFloat(lng));
                    }}
                    style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                  >
                    <Navigation style={{ width: 12, height: 12 }} />
                    Enter manually instead
                  </button>
                )}
              </div>
            </div>

            {/* ── Submit ──────────────────────────────────── */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '1rem', fontSize: '0.9rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}
            >
              {loading ? <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" /> : <Send style={{ width: 16, height: 16 }} />}
              {loading ? 'Submitting...' : (isOnline ? 'Submit Report' : 'Queue for Sync')}
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: '1rem' }}>
              SevaSetu · Secured Field Reporting
            </p>
          </form>

          {/* ── OR Divider ──────────────────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            margin: '1.75rem 0',
          }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(15, 23, 29, 0.1)' }} />
            <span style={{
              fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
              or report via WhatsApp
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(15, 23, 29, 0.1)' }} />
          </div>

          {/* ── WhatsApp Reporting Section ─────────────────────────── */}
          <div className="card" style={{
            padding: '2rem 1.5rem',
            border: '1px solid rgba(37, 211, 102, 0.2)',
            background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.03), rgba(255,255,255,0))',
            textAlign: 'center',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
              marginBottom: '1.5rem',
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                background: 'rgba(37, 211, 102, 0.1)',
                border: '1px solid rgba(37, 211, 102, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <MessageCircle style={{ width: '24px', height: '24px', color: '#25d366' }} />
              </div>
              <h2 style={{
                fontSize: '1.15rem', fontWeight: 800, color: '#0f171d',
                letterSpacing: '-0.02em', margin: 0,
              }}>
                Send a WhatsApp Message
              </h2>
              <p style={{
                fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5, margin: 0,
                maxWidth: '380px',
              }}>
                Use WhatsApp and send a message from your device to report an emergency via our Twilio-powered bot
              </p>
            </div>

            {/* Step 1: Phone Number */}
            <div style={{ marginBottom: '1.15rem' }}>
              <p style={{
                fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: '0.5rem',
              }}>
                WhatsApp Number
              </p>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                background: '#f8fafc', border: '1px solid rgba(15, 23, 29, 0.1)',
                borderRadius: '0.75rem', padding: '0.65rem 1.15rem',
              }}>
                <span style={{ fontSize: '1.15rem' }}>🟢</span>
                <span style={{
                  fontSize: '1.05rem', fontWeight: 700, color: '#0f171d',
                  letterSpacing: '0.02em', fontFamily: "'Inter', system-ui, sans-serif",
                }}>
                  {TWILIO_WHATSAPP_NUMBER}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(TWILIO_WHATSAPP_NUMBER);
                    setCopiedField('phone');
                    setTimeout(() => setCopiedField(null), 2000);
                  }}
                  title="Copy phone number"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '4px', borderRadius: '6px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: copiedField === 'phone' ? '#25d366' : '#94a3b8',
                    transition: 'color 0.2s',
                  }}
                >
                  {copiedField === 'phone' ? (
                    <Check style={{ width: '16px', height: '16px' }} />
                  ) : (
                    <Copy style={{ width: '16px', height: '16px' }} />
                  )}
                </button>
              </div>
            </div>

            {/* Step 2: Sandbox Code */}
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{
                fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: '0.5rem',
              }}>
                with code
              </p>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                background: '#f8fafc', border: '1px solid rgba(15, 23, 29, 0.1)',
                borderRadius: '0.75rem', padding: '0.65rem 1.15rem',
              }}>
                <span style={{
                  fontSize: '1rem', fontWeight: 800, color: '#0f171d',
                  fontFamily: "'Inter', system-ui, sans-serif",
                }}>
                  {TWILIO_SANDBOX_CODE}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(TWILIO_SANDBOX_CODE);
                    setCopiedField('code');
                    setTimeout(() => setCopiedField(null), 2000);
                  }}
                  title="Copy join code"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '4px', borderRadius: '6px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: copiedField === 'code' ? '#25d366' : '#94a3b8',
                    transition: 'color 0.2s',
                  }}
                >
                  {copiedField === 'code' ? (
                    <Check style={{ width: '16px', height: '16px' }} />
                  ) : (
                    <Copy style={{ width: '16px', height: '16px' }} />
                  )}
                </button>
              </div>
            </div>

            {/* Open WhatsApp Button */}
            <button
              type="button"
              onClick={() => {
                if (!TWILIO_WHATSAPP_NUMBER || !TWILIO_SANDBOX_CODE) {
                  console.error('WhatsApp details missing:', { TWILIO_WHATSAPP_NUMBER, TWILIO_SANDBOX_CODE });
                  return;
                }
                const phone = TWILIO_WHATSAPP_NUMBER.replace(/[^0-9]/g, '');
                const message = encodeURIComponent(TWILIO_SANDBOX_CODE);
                window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.55rem',
                background: '#0a652bcb', color: '#ffffff',
                border: 'none', borderRadius: '10px',
                padding: '0.85rem 2.25rem',
                fontSize: '0.9rem', fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(37, 211, 102, 0.3)',
                transition: 'all 0.2s ease',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 28px rgba(37, 211, 102, 0.5)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(37, 211, 102, 0.3)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <MessageCircle style={{ width: '18px', height: '18px' }} />
              Open WhatsApp
              <ExternalLink style={{ width: '14px', height: '14px', opacity: 0.8 }} />
            </button>

            {/* Step 3: Instructions */}
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem 1.15rem',
              background: 'rgba(37, 211, 102, 0.05)',
              border: '1px solid rgba(37, 211, 102, 0.15)',
              borderRadius: '0.75rem',
              textAlign: 'left',
            }}>
              <p style={{
                fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: '0.4rem',
              }}>
                How it works
              </p>
              <p style={{
                fontSize: '0.85rem', color: '#475569', lineHeight: 1.7,
                margin: 0,
              }}>
                After joining the Twilio sandbox, type{' '}
                <strong style={{
                  color: '#2d6148', background: 'rgba(45, 97, 72, 0.08)',
                  padding: '0.15rem 0.5rem', borderRadius: '4px',
                  fontSize: '0.82rem', fontWeight: 800,
                }}>Help</strong>{' '}
                or{' '}
                <strong style={{
                  color: '#2d6148', background: 'rgba(45, 97, 72, 0.08)',
                  padding: '0.15rem 0.5rem', borderRadius: '4px',
                  fontSize: '0.82rem', fontWeight: 800,
                }}>Report</strong>{' '}
                to begin reporting an emergency. The bot will guide you through each step — incident type, location, people affected, and GPS coordinates.
              </p>
            </div>

            {/* Sandbox Note */}
            <p style={{
              fontSize: '0.68rem', color: '#94a3b8', marginTop: '1rem',
              lineHeight: 1.5, fontStyle: 'italic',
            }}>
              ⚠️ This uses the Twilio Sandbox. You must first send the join code above to activate the WhatsApp connection.
            </p>
          </div>
        </div>
      </div>

      {showCamera && (
        <CameraWatermark
          onCapture={(file) => { updateField('imageFile', file); setShowCamera(false); }}
          onCancel={() => setShowCamera(false)}
        />
      )}
    </MainLayout>
  );
};

export default FieldForm;
