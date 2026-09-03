const express = require('express');
const prisma = require('../config/db');

const router = express.Router();

// Minimum SOS Accept API
router.post('/trigger', async (req, res) => {
  try {
    const { 
      clientEventId, 
      deviceId, 
      triggerType, 
      triggeredAt,
      sessionId,
      location, 
      capabilitySnapshot, 
      credentialProof 
    } = req.body;

    if (!clientEventId || !deviceId || !triggerType) {
      return res.status(400).json({ error: 'Missing required fields for minimum SOS' });
    }

    // Idempotent emergency creation using upsert (using clientEventId)
    const incident = await prisma.emergencyEvent.upsert({
      where: { clientEventId },
      update: {
        // If it already exists, maybe update location
        lat: location?.lat ?? undefined,
        lng: location?.lng ?? undefined,
        accuracyMeters: location?.accuracyMeters ?? undefined,
        locationSource: location?.source ?? undefined,
        locationConfidence: location?.confidence ?? undefined,
        updatedAt: new Date()
      },
      create: {
        clientEventId,
        deviceId,
        triggerType,
        triggeredAt: triggeredAt ? new Date(triggeredAt) : new Date(),
        sessionId: sessionId || null,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
        accuracyMeters: location?.accuracyMeters ?? null,
        locationSource: location?.source ?? null,
        locationConfidence: location?.confidence ?? null,
        capabilitySnapshot: capabilitySnapshot || {},
        status: 'INCIDENT_CREATED'
      }
    });

    return res.status(202).json({
      status: 'INCIDENT_CREATED',
      serverIncidentId: incident.clientEventId,
      acceptedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('[EMERGENCY-API] Error processing Minimum SOS:', err);
    res.status(500).json({ error: 'Failed to process emergency event' });
  }
});

// Enrichment API Endpoint
router.post('/:id/facts', async (req, res) => {
  try {
    const { id } = req.params; // id is clientEventId
    const { intent, facts, confidenceByField, modelVersion } = req.body;

    if (!facts) {
      return res.status(400).json({ error: 'Missing facts payload' });
    }

    const incident = await prisma.emergencyEvent.findUnique({
      where: { clientEventId: id }
    });

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // ── Phase 4: Deterministic Safety Rules ──
    // These rules can ONLY upgrade urgency, never downgrade it.
    let newUrgency = 1.0;
    const criticalSignals = [];

    // Rule 1: Trapped
    if (facts.trapped === true) {
      newUrgency = 10.0;
      criticalSignals.push('trapped');
    }
    
    // Rule 2: Fire
    if (facts.fire === true) {
      newUrgency = 10.0;
      criticalSignals.push('fire');
    }

    // Rule 3: Injury
    if (Array.isArray(facts.severitySignals) && facts.severitySignals.includes('injury')) {
      newUrgency = Math.max(newUrgency, 8.0);
      criticalSignals.push('injury');
    }

    // Build the enriched facts object (do not mutate the input directly)
    const enrichedFacts = {
      ...facts,
      deterministicUrgency: newUrgency,
      criticalSignals,
      intent: intent || 'UNKNOWN',
      modelVersion: modelVersion || 'unknown',
      enrichedAt: new Date().toISOString()
    };

    // Persist enriched facts to the MVP voice table
    await prisma.emergencyEvent.update({
      where: { clientEventId: id },
      data: {
        facts: enrichedFacts,
        status: 'URGENCY_CALCULATED',
        updatedAt: new Date()
      }
    });

    // ── Phase 5 Bridge: Push to Coordinator Dashboard ──
    // The Coordinator Dashboard expects records in the `needs` table.
    // Map the voice intent to the closest NeedType enum.
    let mappedType = 'other';
    const lowerIntent = (intent || '').toLowerCase();
    if (lowerIntent.includes('accident')) mappedType = 'accidental';
    else if (lowerIntent.includes('medical') || lowerIntent.includes('ambulance') || lowerIntent.includes('injury')) mappedType = 'medical';
    else if (lowerIntent.includes('fire') || lowerIntent.includes('rescue')) mappedType = 'rescue';

    // Build a readable description from the AI facts
    let desc = "⚠️ VOICE SOS REPORT\n";
    desc += `Critical Signals: ${criticalSignals.length > 0 ? criticalSignals.join(', ') : 'None detected'}\n`;
    if (facts.trapped) desc += `- People Trapped\n`;
    if (facts.fire) desc += `- Fire Reported\n`;
    desc += `\nRaw AI Extraction:\n${JSON.stringify(facts, null, 2)}`;

    const createdNeed = await prisma.need.create({
      data: {
        title: `Voice Alert: ${intent || 'Emergency'}`,
        description: desc,
        needType: mappedType,
        urgencyScore: newUrgency,
        isVerified: true,
        status: 'open',
        isDisasterZone: facts.fire || facts.trapped ? true : false,
      }
    });

    if (incident.lat && incident.lng) {
      await prisma.$executeRaw`
        UPDATE needs
        SET location = ST_SetSRID(ST_MakePoint(${incident.lng}, ${incident.lat}), 4326)
        WHERE id = ${createdNeed.id}::uuid
      `;
    }


    // Emit socket event so coordinator dashboard refreshes in real-time
    if (global.io) {
      global.io.emit('need_created', { id: createdNeed.id, status: 'open' });
      console.log(`[EMERGENCY-API] ✅ need_created emitted → needId: ${createdNeed.id}`);
    }

    // ── Broadcast alert to nearby volunteers ──
    // Only broadcast if we have location data (needed for proximity matching)
    if (incident.lat && incident.lng) {
      const { triggerBroadcast } = require('../services/matchingService');
      triggerBroadcast(createdNeed.id, 10).catch(err => {
        console.error('[EMERGENCY-API] Broadcast to volunteers failed:', err.message);
      });
      console.log(`[EMERGENCY-API] 📡 Volunteer broadcast triggered for needId: ${createdNeed.id}`);
    } else {
      console.log(`[EMERGENCY-API] ⚠️ No location data — skipping volunteer broadcast for needId: ${createdNeed.id}`);
    }

    return res.status(200).json({
      status: 'ENRICHED',
      urgencyScore: newUrgency,
      criticalSignals,
      needId: createdNeed.id,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('[EMERGENCY-API] Error enriching incident:', err);
    res.status(500).json({ error: 'Failed to enrich emergency facts' });
  }
});

module.exports = router;
