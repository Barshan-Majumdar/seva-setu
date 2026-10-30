const express = require('express');
const prisma = require('../config/db');
const { resolveLocation } = require('../services/geocodingService');

const router = express.Router();

/**
 * Minimum SOS Ingestion API
 * Accepts minimal emergency payload. Must NEVER reject requests missing non-essential fields.
 * Idempotent upsert on clientEventId.
 */
router.post('/trigger', async (req, res) => {
  try {
    const { 
      clientEventId, 
      source = 'VOICE',
      triggerType = 'VOICE',
      triggerConfidence = 1.0,
      lat, 
      lng, 
      accuracy, 
      capturedAt, 
      locale = 'en-IN',
      deviceId = 'unknown', 
      sessionId = null,
      location, 
      capabilitySnapshot = {}
    } = req.body;

    if (!clientEventId) {
      return res.status(400).json({ error: 'Missing required clientEventId' });
    }

    const finalLat = lat != null ? Number(lat) : (location?.lat != null ? Number(location.lat) : null);
    const finalLng = lng != null ? Number(lng) : (location?.lng != null ? Number(location.lng) : null);
    const finalAccuracy = accuracy != null ? Number(accuracy) : (location?.accuracyMeters != null ? Number(location.accuracyMeters) : (location?.accuracy != null ? Number(location.accuracy) : null));
    const finalLocationSource = location?.source || (finalLat != null ? 'gps' : null);
    const finalLocationConfidence = location?.confidence != null ? Number(location.confidence) : (finalLat != null ? 0.9 : null);

    // Idempotent emergency creation using upsert (using clientEventId)
    const incident = await prisma.emergencyEvent.upsert({
      where: { clientEventId },
      update: {
        source: source || undefined,
        lat: finalLat != null ? finalLat : undefined,
        lng: finalLng != null ? finalLng : undefined,
        accuracyMeters: finalAccuracy != null ? finalAccuracy : undefined,
        locationSource: finalLocationSource || undefined,
        locationConfidence: finalLocationConfidence != null ? finalLocationConfidence : undefined,
        locale: locale || undefined,
        updatedAt: new Date()
      },
      create: {
        clientEventId,
        deviceId: deviceId || 'unknown',
        triggerType: triggerType || 'VOICE',
        source: source || 'VOICE',
        triggeredAt: capturedAt ? new Date(capturedAt) : new Date(),
        sessionId: sessionId || null,
        lat: finalLat,
        lng: finalLng,
        accuracyMeters: finalAccuracy,
        locationSource: finalLocationSource,
        locationConfidence: finalLocationConfidence,
        capabilitySnapshot: capabilitySnapshot || {},
        locale: locale || 'en-IN',
        urgency: 1.0,
        factsSeq: 0,
        status: 'INCIDENT_CREATED'
      }
    });

    return res.status(201).json({
      clientEventId: incident.clientEventId,
      status: incident.status,
      receivedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('[EMERGENCY-API] Error processing Minimum SOS:', err);
    res.status(500).json({ error: 'Failed to process emergency event' });
  }
});

/**
 * Incremental Facts Enrichment API
 * Enforces monotonic urgency (safety floor: fire/trapped -> 10.0, injury -> min 8.0, max(current, new)).
 * Merges partial facts incrementally with factsSeq ordering.
 */
router.post('/:id/facts', async (req, res) => {
  try {
    const { id } = req.params; // clientEventId
    const { 
      factsSeq = 0, 
      intent = 'GENERAL_EMERGENCY', 
      facts = {}, 
      confidenceByField = {}, 
      modelVersion = 'unknown', 
      location 
    } = req.body;

    let incident = await prisma.emergencyEvent.findUnique({
      where: { clientEventId: id }
    });

    if (!incident) {
      // Golden Law: If facts arrive before SOS trigger ACK, create stub incident so no SOS is lost
      incident = await prisma.emergencyEvent.create({
        data: {
          clientEventId: id,
          deviceId: 'unknown',
          triggerType: 'VOICE',
          source: 'VOICE',
          triggeredAt: new Date(),
          status: 'INCIDENT_CREATED',
          urgency: 1.0,
          factsSeq: 0
        }
      });
    }

    // ── 1. Coordinates Resolution ──
    const lat = location?.lat != null ? Number(location.lat) : incident.lat;
    const lng = location?.lng != null ? Number(location.lng) : incident.lng;
    const accuracyMeters = location?.accuracy != null ? Number(location.accuracy) : (location?.accuracyMeters != null ? Number(location.accuracyMeters) : incident.accuracyMeters);
    const locationText = location?.address || location?.locationText || incident.locationText;

    if (lat != null && lng != null) {
      await prisma.emergencyEvent.update({
        where: { clientEventId: id },
        data: {
          lat: Number(lat),
          lng: Number(lng),
          accuracyMeters: accuracyMeters != null ? Number(accuracyMeters) : undefined,
          locationText: locationText || undefined,
          updatedAt: new Date()
        }
      });
      incident.lat = Number(lat);
      incident.lng = Number(lng);
    }

    // ── 2. Detailed Location Resolution ──
    const locationInfo = await resolveLocation({
      lat,
      lng,
      spokenDistrict: facts.district,
      spokenArea: facts.area,
      spokenLandmark: facts.landmark,
    });

    // ── 3. Deterministic Safety Rules & Urgency Monotonicity ──
    // Safety floor: AI can ONLY raise urgency, never lower it.
    const currentUrgency = incident.urgency || 1.0;
    let calculatedUrgency = 1.0;
    const criticalSignals = [];

    const isTrapped = facts.trapped === true || facts.trapped === 'true' || (Array.isArray(facts.severitySignals) && facts.severitySignals.includes('trapped'));
    const isFire = facts.fire === true || facts.fire === 'true' || (Array.isArray(facts.severitySignals) && facts.severitySignals.includes('fire'));
    const isInjury = (Array.isArray(facts.severitySignals) && facts.severitySignals.includes('injury')) || facts.injured === true || (facts.injuredCount != null && Number(facts.injuredCount) > 0);

    if (isTrapped) {
      calculatedUrgency = 10.0;
      criticalSignals.push('trapped');
    }
    if (isFire) {
      calculatedUrgency = 10.0;
      criticalSignals.push('fire');
    }
    if (isInjury) {
      calculatedUrgency = Math.max(calculatedUrgency, 8.0);
      criticalSignals.push('injury');
    }

    // Monotonic urgency upgrade:
    const newUrgency = Math.max(currentUrgency, calculatedUrgency);

    // ── 4. Incremental Facts Merging ──
    const existingFacts = (incident.facts && typeof incident.facts === 'object') ? incident.facts : {};
    
    // Union arrays
    const unionArrays = (a1, a2) => {
      const set = new Set();
      if (Array.isArray(a1)) a1.forEach(x => x && set.add(x));
      if (Array.isArray(a2)) a2.forEach(x => x && set.add(x));
      return Array.from(set);
    };

    // Demographic counts take max(existing, new) unless explicitly zeroed
    const mergedCounts = {
      peopleCount: Math.max(Number(existingFacts.peopleCount) || 0, Number(facts.peopleCount) || 0) || null,
      childrenCount: Math.max(Number(existingFacts.childrenCount) || 0, Number(facts.childrenCount) || 0) || null,
      womenCount: Math.max(Number(existingFacts.womenCount) || 0, Number(facts.womenCount) || 0) || null,
      pregnantCount: Math.max(Number(existingFacts.pregnantCount) || 0, Number(facts.pregnantCount) || 0) || null,
      injuredCount: Math.max(Number(existingFacts.injuredCount) || 0, Number(facts.injuredCount) || 0) || null,
    };

    const mergedFacts = {
      ...existingFacts,
      ...facts,
      ...mergedCounts,
      severitySignals: unionArrays(existingFacts.severitySignals, unionArrays(facts.severitySignals, criticalSignals)),
      hazards: unionArrays(existingFacts.hazards, facts.hazards),
      trapped: Boolean(existingFacts.trapped || isTrapped),
      fire: Boolean(existingFacts.fire || isFire),
      district: locationInfo.district || facts.district || existingFacts.district || null,
      area: locationInfo.area || facts.area || existingFacts.area || null,
      ward: locationInfo.ward || facts.ward || existingFacts.ward || null,
      fullAddress: locationInfo.fullAddress || locationText || existingFacts.fullAddress || null,
      deterministicUrgency: newUrgency,
      criticalSignals: unionArrays(existingFacts.criticalSignals, criticalSignals),
      intent: intent || existingFacts.intent || 'GENERAL_EMERGENCY',
      modelVersion: modelVersion || existingFacts.modelVersion || 'unknown',
      lastEnrichedAt: new Date().toISOString()
    };

    const newSeq = Math.max(incident.factsSeq || 0, Number(factsSeq) || 0);

    // Persist enriched facts to DB
    await prisma.emergencyEvent.update({
      where: { clientEventId: id },
      data: {
        facts: mergedFacts,
        urgency: newUrgency,
        factsSeq: newSeq,
        status: 'URGENCY_CALCULATED',
        updatedAt: new Date()
      }
    });

    // ── 5. Push to Coordinator Dashboard & Create/Update Need ──
    let mappedType = 'other';
    const lowerIntent = (intent || '').toLowerCase();
    if (lowerIntent.includes('accident')) mappedType = 'accidental';
    else if (lowerIntent.includes('medical') || lowerIntent.includes('ambulance') || lowerIntent.includes('injury')) mappedType = 'medical';
    else if (lowerIntent.includes('fire') || lowerIntent.includes('rescue')) mappedType = 'rescue';

    let desc = "⚠️ VOICE EMERGENCY SOS REPORT\n";
    desc += `📍 District: ${locationInfo.district}\n`;
    desc += `🏘️ Area / Ward: ${locationInfo.area}\n`;
    if (locationInfo.fullAddress) {
      desc += `🗺️ Address: ${locationInfo.fullAddress}\n`;
    }
    if (lat != null && lng != null) {
      desc += `🌐 GPS: ${Number(lat).toFixed(5)}° N, ${Number(lng).toFixed(5)}° E`;
      if (accuracyMeters != null) desc += ` (±${Math.round(accuracyMeters)}m)`;
      desc += `\n`;
    }
    desc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    desc += `Critical Signals: ${criticalSignals.length > 0 ? criticalSignals.join(', ') : 'None detected'}\n`;
    if (mergedFacts.trapped) desc += `- People Trapped\n`;
    if (mergedFacts.fire) desc += `- Fire Reported\n`;
    if (Array.isArray(mergedFacts.severitySignals) && mergedFacts.severitySignals.length > 0) {
      desc += `- Signals: ${mergedFacts.severitySignals.join(', ')}\n`;
    }

    const totalPeople = parseInt(mergedFacts.peopleCount, 10) || 0;
    const numChildren = parseInt(mergedFacts.childrenCount, 10) || 0;
    const numWomen = parseInt(mergedFacts.womenCount, 10) || 0;
    const numPregnant = parseInt(mergedFacts.pregnantCount, 10) || 0;
    const effectivePeople = Math.max(totalPeople, numChildren + numWomen);

    if (effectivePeople > 0 || numWomen > 0 || numChildren > 0) {
      desc += `\n👥 People Affected: ${effectivePeople || "Unspecified"}`;
      if (numWomen > 0) desc += ` (Women: ${numWomen})`;
      if (numChildren > 0) desc += ` (Children: ${numChildren})`;
      if (numPregnant > 0) desc += ` (Pregnant: ${numPregnant})`;
      desc += `\n`;
    }

    const locationTag = locationInfo.area || locationInfo.district;
    const titleWithLocation = locationTag 
      ? `Voice Alert: ${intent || 'Emergency'} (${locationTag})`
      : `Voice Alert: ${intent || 'Emergency'}`;

    const createdNeed = await prisma.need.create({
      data: {
        title: titleWithLocation,
        description: desc,
        needType: mappedType,
        urgencyScore: newUrgency,
        district: locationInfo.district,
        ward: locationInfo.area || locationInfo.ward,
        peopleAffected: effectivePeople || 1,
        childrenCount: numChildren,
        adultsCount: Math.max(0, effectivePeople - numChildren),
        pregnantCount: numPregnant,
        isVerified: true,
        status: 'open',
        isDisasterZone: mergedFacts.fire || mergedFacts.trapped ? true : false,
      }
    });

    if (lat != null && lng != null) {
      await prisma.$executeRaw`
        UPDATE needs
        SET location = ST_SetSRID(ST_MakePoint(${Number(lng)}, ${Number(lat)}), 4326)
        WHERE id = ${createdNeed.id}::uuid
      `;
    }

    // Emit socket event for coordinator dashboard in real-time
    if (global.io) {
      global.io.emit('need_created', { 
        id: createdNeed.id, 
        status: 'open',
        district: locationInfo.district,
        ward: locationInfo.area,
        needType: mappedType,
        urgencyScore: newUrgency
      });
      console.log(`[EMERGENCY-API] ✅ need_created emitted → needId: ${createdNeed.id} | Urgency: ${newUrgency}`);
    }

    // Proximity volunteer broadcast
    if (lat != null && lng != null) {
      const { triggerBroadcast } = require('../services/matchingService');
      triggerBroadcast(createdNeed.id, 10).catch(err => {
        console.error('[EMERGENCY-API] Broadcast to volunteers failed:', err.message);
      });
    }

    return res.status(200).json({
      clientEventId: id,
      urgency: newUrgency,
      status: 'URGENCY_CALCULATED',
      factsSeq: newSeq,
      mergedFacts,
      needId: createdNeed.id
    });
  } catch (err) {
    console.error('[EMERGENCY-API] Error enriching incident:', err);
    res.status(500).json({ error: 'Failed to enrich emergency facts' });
  }
});

module.exports = router;
