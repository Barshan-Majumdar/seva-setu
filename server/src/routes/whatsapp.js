const express = require('express');
const router = express.Router();
let twilio;
try {
  twilio = require('twilio');
} catch (err) {
  console.error('CRITICAL: Twilio module failed to load. WhatsApp features will be disabled.', err.message);
}
const prisma = require('../config/db');
const { calculateScore } = require('../services/scoringService');
const redisService = require('../services/redisService');

// Safe destructuring
const MessagingResponse = twilio?.twiml?.MessagingResponse;

// Middleware to parse Twilio's webhook body
router.use(express.urlencoded({ extended: true }));

router.post('/webhook', async (req, res) => {
  if (!MessagingResponse) {
    console.error('WhatsApp Webhook received but MessagingResponse is not loaded.');
    return res.status(503).send('Messaging service temporarily unavailable');
  }
  const twiml = new MessagingResponse();
  const incomingMsg = req.body.Body?.trim() || '';
  const fromNumber = req.body.From;

  try {
    let session = await redisService.getBotSession(fromNumber);

    if (!session) {
      session = { step: 'idle', stateData: {} };
      await redisService.saveBotSession(fromNumber, session);
    }

    if (incomingMsg.toLowerCase() === 'help' || incomingMsg.toLowerCase() === 'report') {
      session.step = 'awaiting_need_type';
      await redisService.saveBotSession(fromNumber, session);
      
      twiml.message('Emergency Report System\nWhat is the nature of the emergency?\n1. Medical/Medicine\n2. Accidental\n3. Food & Water\n4. Shelter/Housing\n5. Rescue Operations\n6. General/Other\n\nReply with the number.');
    } else if (session.step === 'awaiting_need_type') {
      let needType = 'other';
      if (incomingMsg === '1') needType = 'medical';
      if (incomingMsg === '2') needType = 'accidental';
      if (incomingMsg === '3') needType = 'food';
      if (incomingMsg === '4') needType = 'shelter';
      if (incomingMsg === '5') needType = 'rescue';
      if (incomingMsg === '6') needType = 'other';

      session.step = 'awaiting_district';
      session.stateData = { needType };
      await redisService.saveBotSession(fromNumber, session);
      
      twiml.message('What District is this in? (e.g. "South District")');
    } else if (session.step === 'awaiting_district') {
      session.step = 'awaiting_ward';
      session.stateData = { ...session.stateData, district: incomingMsg };
      await redisService.saveBotSession(fromNumber, session);
      
      twiml.message('What is the name of your Area, Ward, or Village?');
    } else if (session.step === 'awaiting_ward') {
      session.step = 'awaiting_people_count';
      session.stateData = { ...session.stateData, ward: incomingMsg };
      await redisService.saveBotSession(fromNumber, session);
      
      twiml.message('MANDATORY: How many people are approx. affected or injured? (Reply with a number, e.g. "5")');
    } else if (session.step === 'awaiting_people_count') {
      const count = parseInt(incomingMsg) || 1;
      session.step = 'awaiting_description';
      session.stateData = { ...session.stateData, peopleAffected: count };
      await redisService.saveBotSession(fromNumber, session);
      
      twiml.message('Describe the emergency briefly (e.g. "House flooded, families on roof"):');
    } else if (session.step === 'awaiting_description') {
      session.step = 'awaiting_contact_number';
      session.stateData = { ...session.stateData, description: incomingMsg };
      await redisService.saveBotSession(fromNumber, session);
      
      twiml.message('Please provide a Contact Number (Call/WhatsApp) where you can be reached (e.g. 9876543210):');
    } else if (session.step === 'awaiting_contact_number') {
      session.step = 'awaiting_location';
      session.stateData = { ...session.stateData, contactNumber: incomingMsg };
      await redisService.saveBotSession(fromNumber, session);
      
      twiml.message('Almost done. Please share your exact GPS location using the 📎 pin icon in WhatsApp -> Location -> "Send your current location".\n\n(No photo is required for WhatsApp reports)');
    } else if (session.step === 'awaiting_location') {
      if (req.body.Latitude && req.body.Longitude) {
        const lat = parseFloat(req.body.Latitude);
        const lng = parseFloat(req.body.Longitude);
        const state = session.stateData || {};
        
        // Calculate dynamic urgency score (0-10)
        const priorityScore = calculateScore({
          need_type: state.needType,
          people_affected: state.peopleAffected,
          is_verified: true // WhatsApp location sharing is highly trusted
        });

        // WhatsApp title gets auto-generated from description
        const autoTitle = state.description ? state.description.substring(0, 40) + '...' : 'Urgent WhatsApp Report';

        const result = await prisma.$queryRaw`
          INSERT INTO needs (title, description, ward, district, need_type, people_affected, urgency_score, location, is_disaster_zone, status, contact_number, is_verified)
          VALUES (
            ${'WA: ' + autoTitle}, 
            ${state.description || ''},
            ${state.ward || ''},
            ${state.district || ''},
            ${state.needType || 'other'}::"NeedType", 
            ${state.peopleAffected || 1},
            ${priorityScore}, 
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326), 
            true,
            'open'::"NeedStatus",
            ${state.contactNumber || null},
            true
          ) RETURNING id
        `;

        const needId = result[0]?.id;

        // --- AUTOMATED DISPATCH ---
        if (needId) {
          const { triggerBroadcast } = require('../services/matchingService');
          triggerBroadcast(needId, 2).catch(err => console.error('[BROADCAST] WA Trigger failed:', err));
        }

        await redisService.deleteBotSession(fromNumber);
        twiml.message(`Mission Logged! (Priority: ${priorityScore}/10)\nLocation captured for ${state.peopleAffected} people. Volunteers are being dispatched.`);
      } else {
        twiml.message('GPS Location is mandatory. Please use the 📎 icon -> Location -> "Send your current location".');
      }
    } else {
      twiml.message('SevaSetu Response Bot\nSend "Report" or "Help" to log a community need.');
    }
  } catch (error) {
    console.error('WhatsApp Bot Error:', error);
    twiml.message('Sorry, we encountered an error. Please try again.');
  }

  res.type('text/xml').send(twiml.toString());
});

module.exports = router;
