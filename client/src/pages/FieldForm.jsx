import React, { useState } from 'react';
import {
  MapPin, Send, Users, AlertTriangle,
  CheckCircle2, Crosshair, Loader2, Wifi, WifiOff, Clock3, Camera, X
} from 'lucide-react';
import { useFieldForm } from '../hooks/useFieldForm';
import MainLayout from '../layouts/MainLayout';
import CameraWatermark from '../components/CameraWatermark';

const FieldForm = () => {
  const [showCamera, setShowCamera] = useState(false);
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
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Report Captured</h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-8">
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
      <div className="py-12 min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="container-narrow px-4">
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-black text-white tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-indigo-400">
              Field Report Terminal
            </h1>
            <p className="text-lg text-slate-400 max-w-lg mx-auto">
              Strategic intake for verified ground reports. AI-powered "Trust Layer" active.
            </p>
          </div>

          <div className="mb-8 flex justify-center items-center gap-4 text-xs font-bold tracking-widest uppercase">
            <span
              className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border transition-all duration-500 ${
                isOnline
                  ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                  : 'border-amber-500/30 text-amber-400 bg-amber-500/10'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {isOnline ? 'System Online' : 'Offline Mode'}
            </span>

            <span className="flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border border-slate-700 text-slate-300 bg-slate-800/50">
              <Clock3 className="w-3.5 h-3.5" />
              Queue: {queuedCount}
            </span>
          </div>

          <form onSubmit={submitForm} className="space-y-8">
            {error ? (
              <div className="flex items-center gap-3 p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            ) : null}

            {/* Core Details */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-[2rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
              <div className="relative glass p-8 rounded-[2rem] border border-white/10 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 px-1">
                      Need Classification
                    </label>
                    <select
                      className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500/50 outline-none transition-all appearance-none"
                      value={formData.need_type}
                      onChange={(e) => updateField('need_type', e.target.value)}
                    >
                      <option value="medical">🚑 Medical / Medicine</option>
                      <option value="accidental">⚠️ Accidental</option>
                      <option value="food">🍱 Food & Water</option>
                      <option value="shelter">⛺ Shelter / Housing</option>
                      <option value="rescue">🚁 Rescue Operations</option>
                      <option value="other">📦 General / Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 px-1">Headcount</label>
                    <div className="relative">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="number"
                        className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl pl-12 pr-4 py-3 focus:ring-2 focus:ring-sky-500/50 outline-none transition-all"
                        placeholder="Approx. affected"
                        value={formData.people_affected}
                        onChange={(e) => updateField('people_affected', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 px-1">Report Headline *</label>
                  <input
                    required
                    className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500/50 outline-none transition-all"
                    placeholder="Briefly describe the crisis"
                    value={formData.title}
                    onChange={(e) => updateField('title', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 px-1">Intel Details</label>
                  <textarea
                    className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 h-32 focus:ring-2 focus:ring-sky-500/50 outline-none transition-all resize-none"
                    placeholder="Provide specific context for rapid response..."
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-sky-500/5 border border-sky-500/10 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">Priority Index</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-black text-white">{urgencyPreview}</span>
                      <span className="text-xs text-slate-500 font-bold">/ 10</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateField('is_disaster_zone', !formData.is_disaster_zone)}
                    className={`flex flex-col justify-center items-center gap-1 rounded-2xl border transition-all duration-300 ${
                      formData.is_disaster_zone
                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.1)]'
                        : 'bg-slate-900/50 border-slate-700/50 text-slate-500 grayscale'
                    }`}
                  >
                    <AlertTriangle className={`w-5 h-5 ${formData.is_disaster_zone ? 'animate-pulse' : ''}`} />
                    <span className="text-[10px] font-black uppercase tracking-tighter">Disaster Mode</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Verification Layer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Image Evidence */}
              <div className="glass p-6 rounded-[2rem] border border-white/10 flex flex-col justify-between min-h-[220px]">
                <div>
                  <h2 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-1 flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-sky-500 rounded-full" />
                    Visual Evidence
                  </h2>
                  <p className="text-[10px] text-slate-500 mb-6 font-bold uppercase tracking-widest">Factor 1: AI Verification</p>
                </div>

                <div className="relative flex flex-col gap-3">
                  {formData.imageFile ? (
                    <div className="w-full flex items-center justify-between p-4 rounded-2xl border border-sky-500/50 bg-sky-500/10 text-sky-400">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <CheckCircle2 className="w-5 h-5 shrink-0 text-sky-400" />
                        <span className="font-bold text-sm truncate">{formData.imageFile.name}</span>
                      </div>
                      <button type="button" onClick={() => updateField('imageFile', null)} className="p-2 hover:bg-sky-500/20 rounded-full text-sky-300">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowCamera(true)}
                        className="w-full flex items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all cursor-pointer"
                      >
                        <Camera className="w-6 h-6" />
                        <div className="text-left">
                          <div className="font-bold text-sm">Live GPS Camera</div>
                          <div className="text-[10px] uppercase tracking-widest opacity-80">Highly Recommended</div>
                        </div>
                      </button>

                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => updateField('imageFile', e.target.files[0])}
                          className="hidden"
                          id="image-upload"
                        />
                        <label
                          htmlFor="image-upload"
                          className="w-full flex items-center justify-center gap-3 p-4 rounded-xl border border-slate-700 hover:bg-slate-800/50 text-slate-400 transition-all cursor-pointer"
                        >
                          <Send className="w-4 h-4" />
                          <span className="font-bold text-xs uppercase tracking-wider">Upload from Gallery</span>
                        </label>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* GPS Capture */}
              <div className="glass p-6 rounded-[2rem] border border-white/10 flex flex-col justify-between min-h-[220px]">
                <div>
                  <h2 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-1 flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                    Spatial Identity
                  </h2>
                  <p className="text-[10px] text-slate-500 mb-6 font-bold uppercase tracking-widest">Factor 2: GPS Metadata</p>
                </div>

                <button
                  type="button"
                  onClick={getLocation}
                  disabled={locLoading}
                  className={`w-full flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed transition-all duration-500 ${
                    formData.lat
                      ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-400'
                      : 'border-slate-700 hover:border-indigo-500/30 hover:bg-slate-800/50 text-slate-500'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900/50 flex items-center justify-center border border-white/5">
                    {locLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                    ) : formData.lat ? (
                      <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                    ) : (
                      <Crosshair className="w-5 h-5" />
                    )}
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-sm tracking-tight">
                      {formData.lat ? 'Spatial Link Locked' : 'Capture Location'}
                    </div>
                    <div className="text-[10px] opacity-60 mt-1 uppercase font-black tracking-widest">
                      {formData.lat
                        ? `${formData.lat.toFixed(4)}, ${formData.lng.toFixed(4)}`
                        : 'Precision Lock Required'}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="group relative w-full py-5 rounded-2xl overflow-hidden transition-all active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-sky-600 to-indigo-600 group-hover:scale-105 transition-transform duration-500"></div>
              <div className="relative flex items-center justify-center gap-3 text-white font-black uppercase tracking-[0.3em] text-sm">
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    {isOnline ? 'Initiate Transmission' : 'Queue Intel'}
                  </>
                )}
              </div>
            </button>

            <p className="text-center text-[10px] text-slate-600 font-black uppercase tracking-[0.2em] pb-8">
              Secured Connection • Intel Radiance v4.0 • SevaSetu Network
            </p>
          </form>
        </div>
      </div>
      
      {showCamera && (
        <CameraWatermark 
          onCapture={(file) => {
            updateField('imageFile', file);
            setShowCamera(false);
          }} 
          onCancel={() => setShowCamera(false)} 
        />
      )}
    </MainLayout>
  );
};

export default FieldForm;
