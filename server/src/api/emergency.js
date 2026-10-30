const express = require('express');
const prisma = require('../config/db');
const { resolveLocation } = require('../services/geocodingService');
const { calculatePriority } = require('../services/scoringService');
const redisService = require('../services/redisService');

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
      sessionId,
      capabilities,
      userId,
      reportedBy
    } = req.body;

    if (!clientEventId) {
      return res.status(400).json({ error: 'clientEventId is strictly mandatory' });
    }

    const effectiveUserId = userId || reportedBy || null;

    const incident = await prisma.emergencyEvent.upsert({
      where: { clientEventId },
      update: {
        // Idempotent: monotonic updates or retain existing
        lat: (lat != null && !isNaN(Number(lat))) ? Number(lat) : undefined,
        lng: (lng != null && !isNaN(Number(lng))) ? Number(lng) : undefined,
        accuracyMeters: (accuracy != null && !isNaN(Number(accuracy))) ? Number(accuracy) : undefined,
        locale: locale || undefined,
        updatedAt: new Date()
      },
      create: {
        clientEventId,
        deviceId: 'unknown',
        triggerType,
        source,
        triggeredAt: capturedAt ? new Date(capturedAt) : new Date(),
        sessionId,
        urgency: 1.0,
        lat: (lat != null && !isNaN(Number(lat))) ? Number(lat) : null,
        lng: (lng != null && !isNaN(Number(lng))) ? Number(lng) : null,
        accuracyMeters: (accuracy != null && !isNaN(Number(accuracy))) ? Number(accuracy) : null,
        locale,
        capabilitySnapshot: capabilities || {},
        facts: {
          emergencyType: 'UNKNOWN',
          severitySignals: [],
          demographics: {},
          hazards: [],
          confidenceByField: {}
        },
        status: 'INCIDENT_CREATED',
        factsSeq: 0
      }
    });

    console.log(`[EMERGENCY-API] 🚨 Emergency SOS Triggered: ${clientEventId} (Status: ${incident.status})`);

    return res.status(200).json({
      clientEventId: incident.clientEventId,
      status: incident.status,
      urgency: incident.urgency,
      factsSeq: incident.factsSeq,
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    console.error('[EMERGENCY-API] Critical ingestion failure in /trigger:', err);
    res.status(500).json({ error: 'Failed to record emergency SOS' });
  }
});

/**
 * Incremental Facts Enrichment API
 * Wraps Need creation and facts enrichment in an authoritative PostgreSQL row-level lock (FOR UPDATE).
 * Guarantees zero duplicate Need rows and implements the Durable Outbox Pattern for volunteer dispatch.
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

    // Extract user ID from body or Authorization token
    let finalUserId = req.body.userId || req.body.reportedBy || null;
    if (!finalUserId && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const { verifyClerkJwt } = require('../services/clerkService');
        const decoded = await verifyClerkJwt(token).catch(() => null);
        if (decoded?.sub) {
          const u = await prisma.user.findFirst({ where: { clerkId: decoded.sub }, select: { id: true } });
          if (u) finalUserId = u.id;
        }
      } catch (_) {}
    }

    if (finalUserId) {
      const validUser = await prisma.user.findUnique({ where: { id: finalUserId }, select: { id: true } }).catch(() => null);
      if (!validUser) finalUserId = null;
    }

    // ── Execute in Interactive Transaction with Row-Level Locking ──
    const txResult = await prisma.$transaction(async (tx) => {
      // 1. Acquire exclusive row-level lock on emergency_events
      let [lockedEvent] = await tx.$queryRaw`
        SELECT client_event_id, urgency, facts, status, lat, lng, accuracy_meters, location_text, facts_seq
        FROM emergency_events
        WHERE client_event_id = ${id}
        FOR UPDATE
      `;

      if (!lockedEvent) {
        // Stub creation if facts arrived before trigger ACK
        await tx.emergencyEvent.create({
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

        [lockedEvent] = await tx.$queryRaw`
          SELECT client_event_id, urgency, facts, status, lat, lng, accuracy_meters, location_text, facts_seq
          FROM emergency_events
          WHERE client_event_id = ${id}
          FOR UPDATE
        `;
      }

      // 2. Resolve genuine GPS coordinates (zero fake coordinates)
      const lat = (location?.lat != null && !isNaN(Number(location.lat)))
        ? Number(location.lat)
        : (lockedEvent.lat != null ? Number(lockedEvent.lat) : null);
      const lng = (location?.lng != null && !isNaN(Number(location.lng)))
        ? Number(location.lng)
        : (lockedEvent.lng != null ? Number(lockedEvent.lng) : null);
      const accuracyMeters = (location?.accuracy != null && !isNaN(Number(location.accuracy)))
        ? Number(location.accuracy)
        : (lockedEvent.accuracy_meters != null ? Number(lockedEvent.accuracy_meters) : null);
      const locationText = location?.address || location?.locationText || lockedEvent.location_text;

      if (lat != null && lng != null) {
        await tx.emergencyEvent.update({
          where: { clientEventId: id },
          data: {
            lat: Number(lat),
            lng: Number(lng),
            accuracyMeters: accuracyMeters != null ? Number(accuracyMeters) : undefined,
            locationText: locationText || undefined,
            updatedAt: new Date()
          }
        });
      }

      // 3. Location info resolution
      const locationInfo = await resolveLocation({
        lat,
        lng,
        spokenDistrict: facts.district,
        spokenArea: facts.area,
        spokenLandmark: facts.landmark,
      });

      // 4. Deterministic safety rules & Monotonic Urgency
      const currentUrgency = lockedEvent.urgency || 1.0;
      let calculatedUrgency = 1.0;
      const criticalSignals = [];

      const isTrapped = facts.trapped === true || facts.trapped === 'true' || (Array.isArray(facts.severitySignals) && facts.severitySignals.includes('trapped'));
      const isFire = facts.fire === true || facts.fire === 'true' || (Array.isArray(facts.severitySignals) && facts.severitySignals.includes('fire'));
      const isInjury = (Array.isArray(facts.severitySignals) && (facts.severitySignals.includes('injury') || facts.severitySignals.includes('injured'))) || facts.injured === true || (facts.injuredCount != null && Number(facts.injuredCount) > 0);

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

      const newUrgency = Math.max(currentUrgency, calculatedUrgency);

      // 5. Incremental facts merging
      const existingFacts = (lockedEvent.facts && typeof lockedEvent.facts === 'object') ? lockedEvent.facts : {};
      
      const unionArrays = (a1, a2) => {
        const set = new Set();
        if (Array.isArray(a1)) a1.forEach(x => x && set.add(x));
        if (Array.isArray(a2)) a2.forEach(x => x && set.add(x));
        return Array.from(set);
      };

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
        district: locationInfo.district !== 'Unspecified District' ? locationInfo.district : (existingFacts.district || null),
        area: locationInfo.area !== 'Unspecified Area' ? locationInfo.area : (existingFacts.area || null),
        ward: locationInfo.ward !== 'Unspecified Area' ? locationInfo.ward : (existingFacts.ward || null),
        fullAddress: locationInfo.fullAddress || locationText || existingFacts.fullAddress || null,
        deterministicUrgency: newUrgency,
        criticalSignals: unionArrays(existingFacts.criticalSignals, criticalSignals),
        intent: intent || existingFacts.intent || 'GENERAL_EMERGENCY',
        modelVersion: modelVersion || existingFacts.modelVersion || 'unknown',
        lastEnrichedAt: new Date().toISOString()
      };

      const incomingSeq = Number(factsSeq) || 0;
      const newSeq = (incomingSeq > 2147483640)
        ? ((lockedEvent.facts_seq || 0) + 1)
        : Math.max(lockedEvent.facts_seq || 0, incomingSeq);

      let mappedType = 'other';
      const lowerIntent = (intent || '').toLowerCase();
      if (lowerIntent.includes('accident')) mappedType = 'accidental';
      else if (lowerIntent.includes('medical') || lowerIntent.includes('ambulance') || lowerIntent.includes('injury')) mappedType = 'medical';
      else if (lowerIntent.includes('fire') || lowerIntent.includes('rescue') || lowerIntent.includes('flood')) mappedType = 'rescue';
      else if (lowerIntent.includes('edc')) mappedType = 'other';

      const totalPeople = parseInt(mergedFacts.peopleCount, 10) || 0;
      const numChildren = parseInt(mergedFacts.childrenCount, 10) || 0;
      const numWomen = parseInt(mergedFacts.womenCount, 10) || 0;
      const numPregnant = parseInt(mergedFacts.pregnantCount, 10) || 0;
      const effectivePeople = Math.max(totalPeople, numChildren + numWomen, 1);

      let desc = "⚠️ VOICE EMERGENCY SOS REPORT\n";
      if (locationInfo.district && locationInfo.district !== 'Unspecified District') desc += `📍 District: ${locationInfo.district}\n`;
      if (locationInfo.area && locationInfo.area !== 'Unspecified Area') desc += `🏘️ Area / Ward: ${locationInfo.area}\n`;
      if (locationInfo.fullAddress) desc += `🗺️ Address: ${locationInfo.fullAddress}\n`;

      if (lat != null && lng != null) {
        desc += `🌐 GPS: ${Number(lat).toFixed(5)}° N, ${Number(lng).toFixed(5)}° E`;
        if (accuracyMeters != null) desc += ` (±${Math.round(accuracyMeters)}m)`;
        desc += `\n`;
      } else {
        desc += `⚠️ GPS Coordinates Unavailable — Refer to Spoken Landmark Details\n`;
      }
      desc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      desc += `Critical Signals: ${criticalSignals.length > 0 ? criticalSignals.join(', ') : 'None detected'}\n`;
      if (mergedFacts.trapped) desc += `- People Trapped\n`;
      if (mergedFacts.fire) desc += `- Fire Reported\n`;
      if (lowerIntent.includes('edc')) desc += `- Trigger: EDC\n`;

      if (effectivePeople > 0 || numWomen > 0 || numChildren > 0) {
        desc += `\n👥 People Affected: ${effectivePeople || "Unspecified"}`;
        if (numWomen > 0) desc += ` (Women: ${numWomen})`;
        if (numChildren > 0) desc += ` (Children: ${numChildren})`;
        if (numPregnant > 0) desc += ` (Pregnant: ${numPregnant})`;
        desc += `\n`;
      }

      const locationTag = (locationInfo.area && locationInfo.area !== 'Unspecified Area') 
        ? locationInfo.area 
        : ((locationInfo.district && locationInfo.district !== 'Unspecified District') ? locationInfo.district : null);

      const titleWithLocation = locationTag 
        ? `Voice Alert: ${intent || 'Emergency'} (${locationTag})`
        : `Voice Alert: ${intent || 'Emergency'}`;

      // Calculate Priority Score
      const scoringResult = calculatePriority({
        need_type: mappedType,
        people_affected: effectivePeople,
        children_count: numChildren,
        adults_count: Math.max(0, effectivePeople - numChildren),
        pregnant_count: numPregnant,
        title: titleWithLocation,
        description: desc,
        is_disaster_zone: Boolean(mergedFacts.fire || mergedFacts.trapped),
        is_verified: true,
      });

      const finalUrgencyScore = Math.max(newUrgency, scoringResult.urgency_score || 1.0);
      const finalPriorityLevel = (finalUrgencyScore >= 9.0 || scoringResult.priority_level === 'High') ? 'High' : (scoringResult.priority_level || 'Medium');
      const finalVulnerabilityFactors = unionArrays(scoringResult.vulnerability_factors || [], criticalSignals);

      const finalLat = (lat != null && !isNaN(Number(lat))) ? Number(lat) : null;
      const finalLng = (lng != null && !isNaN(Number(lng))) ? Number(lng) : null;
      const hasCoordinates = finalLat != null && finalLng != null;

      // ── CHECK IDEMPOTENCY: Does a Need already exist for this event? ──
      const existingNeedId = existingFacts.needId;

      if (existingNeedId) {
        console.log(`[EMERGENCY-API] 🛡️ Idempotent call for ${id}. Need ${existingNeedId} already exists.`);
        
        // Check if broadcast requests exist in DB
        const existingBroadcastCount = await tx.broadcastRequest.count({
          where: { needId: existingNeedId }
        });

        // Update the existing need with refreshed demographics/urgency
        await tx.need.update({
          where: { id: existingNeedId },
          data: {
            urgencyScore: finalUrgencyScore,
            priorityLevel: finalPriorityLevel,
            vulnerabilityFactors: finalVulnerabilityFactors,
            peopleAffected: effectivePeople,
            childrenCount: numChildren,
            adultsCount: Math.max(0, effectivePeople - numChildren),
            pregnantCount: numPregnant,
            updatedAt: new Date()
          }
        });

        const updatedMergedFacts = {
          ...mergedFacts,
          needId: existingNeedId,
          dispatchState: (existingBroadcastCount > 0) ? 'DISPATCHED' : (hasCoordinates ? 'QUEUED' : 'COORDINATOR_TRIAGE_REQUIRED'),
          hasCoordinates
        };

        await tx.emergencyEvent.update({
          where: { clientEventId: id },
          data: {
            facts: updatedMergedFacts,
            urgency: finalUrgencyScore,
            factsSeq: newSeq,
            updatedAt: new Date()
          }
        });

        return {
          needId: existingNeedId,
          shouldBroadcast: hasCoordinates && existingBroadcastCount === 0, // Recover interrupted broadcast
          urgency: finalUrgencyScore,
          priorityLevel: finalPriorityLevel,
          titleWithLocation,
          finalUserId,
          mappedType,
          district: locationInfo.district,
          ward: locationInfo.area,
          hasCoordinates,
          newSeq,
          mergedFacts: updatedMergedFacts,
          isNewNeed: false
        };
      }

      // ── FIRST TIME: CREATE REAL NEED ──
      const createdNeed = await tx.need.create({
        data: {
          title: titleWithLocation,
          description: desc,
          needType: mappedType,
          urgencyScore: finalUrgencyScore,
          priorityLevel: finalPriorityLevel,
          vulnerabilityFactors: finalVulnerabilityFactors,
          district: (locationInfo.district && locationInfo.district !== 'Unspecified District') ? locationInfo.district : null,
          ward: (locationInfo.area && locationInfo.area !== 'Unspecified Area') ? locationInfo.area : null,
          peopleAffected: effectivePeople,
          childrenCount: numChildren,
          adultsCount: Math.max(0, effectivePeople - numChildren),
          pregnantCount: numPregnant,
          isVerified: true,
          status: 'open',
          isDisasterZone: Boolean(mergedFacts.fire || mergedFacts.trapped),
          reportedBy: finalUserId || undefined,
        }
      });

      // Update PostGIS geometry ONLY if genuine coordinates are provided
      if (hasCoordinates) {
        await tx.$executeRaw`
          UPDATE needs
          SET location = ST_SetSRID(ST_MakePoint(${finalLng}::float, ${finalLat}::float), 4326),
              priority_level = ${finalPriorityLevel},
              vulnerability_factors = ${finalVulnerabilityFactors}::text[],
              children_count = ${numChildren}::int,
              adults_count = ${Math.max(0, effectivePeople - numChildren)}::int,
              pregnant_count = ${numPregnant}::int
          WHERE id = ${createdNeed.id}::uuid
        `;
      }

      const updatedMergedFacts = {
        ...mergedFacts,
        needId: createdNeed.id,
        dispatchState: hasCoordinates ? 'QUEUED' : 'COORDINATOR_TRIAGE_REQUIRED',
        dispatchQueuedAt: new Date().toISOString(),
        hasCoordinates
      };

      await tx.emergencyEvent.update({
        where: { clientEventId: id },
        data: {
          facts: updatedMergedFacts,
          urgency: finalUrgencyScore,
          factsSeq: newSeq,
          status: hasCoordinates ? 'DISPATCH_QUEUED' : 'URGENCY_CALCULATED',
          updatedAt: new Date()
        }
      });

      return {
        needId: createdNeed.id,
        shouldBroadcast: hasCoordinates,
        urgency: finalUrgencyScore,
        priorityLevel: finalPriorityLevel,
        titleWithLocation,
        finalUserId,
        mappedType,
        district: createdNeed.district,
        ward: createdNeed.ward,
        hasCoordinates,
        newSeq,
        mergedFacts: updatedMergedFacts,
        createdAt: createdNeed.createdAt,
        isNewNeed: true
      };
    }, { timeout: 15000 });

    // ── POST-TRANSACTION ASYNCHRONOUS OPERATIONS ──
    // Smart cache invalidation so user dashboard & coordinator immediately see the updated need
    await redisService.clearCache('/api/needs').catch(() => {});
    await redisService.clearCache('/api/coordinators/stats').catch(() => {});

    // Emit Socket.IO event for coordinator dashboard and reporter in real-time
    if (global.io) {
      global.io.emit('need_created', { 
        id: txResult.needId, 
        status: 'open',
        district: txResult.district,
        ward: txResult.ward,
        need_type: txResult.mappedType,
        needType: txResult.mappedType,
        urgency_score: txResult.urgency,
        urgencyScore: txResult.urgency,
        priority_level: txResult.priorityLevel,
        priorityLevel: txResult.priorityLevel,
        reported_by: txResult.finalUserId || null,
        reportedBy: txResult.finalUserId || null,
        title: txResult.titleWithLocation,
        has_coordinates: txResult.hasCoordinates,
        location_status: txResult.hasCoordinates ? 'GEOLOCATED' : 'COORDINATOR_TRIAGE_REQUIRED',
        created_at: txResult.createdAt || new Date()
      });
      console.log(`[EMERGENCY-API] ✅ need_created emitted → needId: ${txResult.needId} | Coordinates: ${txResult.hasCoordinates}`);
    }

    // Execute Volunteer Proximity Broadcast exactly once
    if (txResult.shouldBroadcast) {
      const { triggerBroadcast } = require('../services/matchingService');
      triggerBroadcast(txResult.needId, 10).then(async (broadcastRes) => {
        await prisma.emergencyEvent.updateMany({
          where: { clientEventId: id, status: { not: 'CANCELLED' } },
          data: {
            status: 'DISPATCH_COMPLETED',
            facts: {
              ...txResult.mergedFacts,
              dispatchState: 'DISPATCHED',
              broadcastVolunteerCount: broadcastRes?.count || 0,
              broadcastCompletedAt: new Date().toISOString()
            }
          }
        }).catch(() => {});
      }).catch(err => {
        console.error('[EMERGENCY-API] Broadcast to volunteers notice:', err.message);
      });
    } else if (!txResult.hasCoordinates) {
      console.log(`[EMERGENCY-API] ℹ️ Need ${txResult.needId} submitted without GPS. Escalated to coordinator triage.`);
    }

    return res.status(200).json({
      clientEventId: id,
      needId: txResult.needId,
      urgency: txResult.urgency,
      priorityLevel: txResult.priorityLevel,
      status: txResult.hasCoordinates ? 'URGENCY_CALCULATED' : 'COORDINATOR_TRIAGE_REQUIRED',
      hasCoordinates: txResult.hasCoordinates,
      factsSeq: txResult.newSeq,
      mergedFacts: txResult.mergedFacts,
      reportedBy: txResult.finalUserId || null
    });
  } catch (err) {
    console.error('[EMERGENCY-API] Error enriching incident:', err);
    res.status(500).json({ error: 'Failed to enrich emergency facts' });
  }
});

/**
 * Emergency Cancellation API
 * Safely cancels an emergency session if the user aborted, triggered a false alarm, or cancelled.
 * Updates emergency_events status to 'CANCELLED'.
 * If a Need was already created, archives the Need and cancels pending broadcasts.
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'USER_CANCELLED' } = req.body || {};

    const incident = await prisma.emergencyEvent.findUnique({
      where: { clientEventId: id }
    });

    if (!incident) {
      return res.status(404).json({ error: 'Emergency event not found' });
    }

    const needId = incident.facts?.needId;

    await prisma.$transaction(async (tx) => {
      await tx.emergencyEvent.update({
        where: { clientEventId: id },
        data: {
          status: 'CANCELLED',
          facts: {
            ...(incident.facts || {}),
            cancellationReason: reason,
            cancelledAt: new Date().toISOString()
          }
        }
      });

      if (needId) {
        await tx.need.update({
          where: { id: needId },
          data: { status: 'archived' }
        }).catch(() => {});

        await tx.broadcastRequest.updateMany({
          where: { needId, status: 'pending' },
          data: { status: 'cancelled' }
        }).catch(() => {});
      }
    });

    if (global.io) {
      global.io.emit('emergency_cancelled', { clientEventId: id, needId, reason });
    }

    console.log(`[EMERGENCY-API] 🛑 Emergency ${id} cancelled (${reason})`);
    return res.status(200).json({ status: 'CANCELLED', clientEventId: id, needId: needId || null });
  } catch (err) {
    console.error('[EMERGENCY-API] Error cancelling emergency:', err);
    res.status(500).json({ error: 'Failed to cancel emergency' });
  }
});

module.exports = router;
