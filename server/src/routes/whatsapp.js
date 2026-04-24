const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const prisma = require('../db');

const { MessagingResponse } = twilio.twiml;

// Middleware to parse Twilio's webhook body
router.use(express.urlencoded({ extended: true }));

router.post('/webhook', async (req, res) => {
  const twiml = new MessagingResponse();
  const incomingMsg = req.body.Body?.trim() || '';
  const fromNumber = req.body.From; // Format usually "whatsapp:+1234567890"

  try {
    // Check if we have a session
    let session = await prisma.botSession.findUnique({
      where: { phoneNumber: fromNumber }
    });

    if (!session) {
      session = await prisma.botSession.create({
        data: { phoneNumber: fromNumber, step: 'idle' }
      });
    }

    // Very basic State Machine for Rapid Need Reporting
    if (incomingMsg.toLowerCase() === 'help' || incomingMsg.toLowerCase() === 'report') {
      await prisma.botSession.update({
        where: { phoneNumber: fromNumber },
        data: { step: 'awaiting_need_type' }
      });
      twiml.message('Welcome to SevaSetu. What type of assistance is required?\n1. Medical\n2. Food\n3. Shelter\n4. Rescue\n\nReply with the number.');
    } else if (session.step === 'awaiting_need_type') {
      let needType = 'other';
      if (incomingMsg === '1') needType = 'medical';
      if (incomingMsg === '2') needType = 'food';
      if (incomingMsg === '3') needType = 'shelter';
      if (incomingMsg === '4') needType = 'other';

      await prisma.botSession.update({
        where: { phoneNumber: fromNumber },
        data: { 
          step: 'awaiting_description', 
          stateData: { needType } 
        }
      });
      twiml.message('Got it. Please describe the exact situation or emergency briefly:');
    } else if (session.step === 'awaiting_description') {
      const state = typeof session.stateData === 'string' ? JSON.parse(session.stateData) : (session.stateData || {});
      
      await prisma.botSession.update({
        where: { phoneNumber: fromNumber },
        data: { 
          step: 'awaiting_area_name', 
          stateData: { ...state, description: incomingMsg } 
        }
      });
      twiml.message('Noted. What is the name of your Area, Ward, or Village?');
    } else if (session.step === 'awaiting_area_name') {
      const state = typeof session.stateData === 'string' ? JSON.parse(session.stateData) : (session.stateData || {});
      
      await prisma.botSession.update({
        where: { phoneNumber: fromNumber },
        data: { 
          step: 'awaiting_location', 
          stateData: { ...state, areaName: incomingMsg } 
        }
      });
      twiml.message('Almost done. Please send your exact location using WhatsApp\'s "Share Location" feature (the 📎 pin icon).');
    } else if (session.step === 'awaiting_location') {
      // Twilio sends Latitude and Longitude if a location is shared
      if (req.body.Latitude && req.body.Longitude) {
        const lat = parseFloat(req.body.Latitude);
        const lng = parseFloat(req.body.Longitude);
        const state = typeof session.stateData === 'string' ? JSON.parse(session.stateData) : (session.stateData || {});
        
        // Create Need (Using raw SQL because of PostGIS)
        await prisma.$executeRaw`
          INSERT INTO needs (title, description, ward, need_type, urgency_score, location, is_disaster_zone)
          VALUES (
            'Urgent WhatsApp Request', 
            ${state.description || ''},
            ${state.areaName || ''},
            ${state.needType || 'other'}::"NeedType", 
            5.0, 
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326), 
            true
          )
        `;

        await prisma.botSession.update({
          where: { phoneNumber: fromNumber },
          data: { step: 'idle', stateData: {} }
        });
        twiml.message('Request Logged. We have captured your description, area, and location. Volunteers will be dispatched shortly.');
      } else {
        twiml.message('We need your exact location. Please click the attachment pin icon 📎 and select "Location" to share it.');
      }
    } else {
      twiml.message('Welcome to SevaSetu! Send "Help" to report an emergency.');
    }
  } catch (error) {
    console.error('WhatsApp Bot Error:', error);
    twiml.message('Sorry, we encountered an error processing your request. Please try again.');
  }

  res.type('text/xml').send(twiml.toString());
});

module.exports = router;
