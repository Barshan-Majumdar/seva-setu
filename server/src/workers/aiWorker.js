const { Worker } = require('bullmq');
const { connection } = require('../config/queue');
const prisma = require('../config/db');
const imagekit = require('../config/imagekit');
const axios = require('axios');
const FormData = require('form-data');
const exifr = require('exifr');
const fs = require('fs');
const path = require('path');
const { calculateScore } = require('../services/scoringService');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

const aiWorker = new Worker('ai-verification', async (job) => {
  const { type, id, filePath, fileName, metadata } = job.data;
  console.log(`[Worker] Processing ${type} job for ID: ${id}`);

  let errors = [];
  let isVerified = false;
  let imageUrl = null;
  let photoHasGps = false;
  let geoTagPassed = false;

  try {
    // 1. GPS Check
    if (metadata && metadata.lat && metadata.lng) {
      try {
        const exifrData = await exifr.parse(filePath, { gps: true });
        let photoLat = exifrData?.latitude;
        let photoLng = exifrData?.longitude;

        const toRad = (val) => (val * Math.PI) / 180;
        const R = 6371;
        const getDistance = (lat1, lon1, lat2, lon2) => {
          const dLat = toRad(lat2 - lat1);
          const dLon = toRad(lon2 - lon1);
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        if (photoLat && photoLng) {
          photoHasGps = true;
          const dist = getDistance(photoLat, photoLng, metadata.lat, metadata.lng);
          if (dist <= 1.0) geoTagPassed = true;
          else errors.push(`Location mismatch: Photo is ${dist.toFixed(2)}km away.`);
        } else if (metadata.browserLat && metadata.browserLng) {
          const dist = getDistance(metadata.browserLat, metadata.browserLng, metadata.lat, metadata.lng);
          if (dist <= 1.0) geoTagPassed = true;
          else errors.push(`Location mismatch: Device is ${dist.toFixed(2)}km away.`);
        }
      } catch (e) {
        console.error(`[Worker] GPS check failed: ${e.message}`);
      }
    }

    // 2. AI Content Check
    try {
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath), { filename: fileName });
      form.append('upload_type', type === 'task' ? 'PROOF_OF_RELIEF' : 'ISSUE_REGISTRATION');

      const aiResponse = await axios.post(`${AI_SERVICE_URL}/verify-image`, form, {
        headers: form.getHeaders(),
        timeout: 30000
      });

      if (aiResponse.data.is_verified) isVerified = true;
      else errors.push(aiResponse.data.reason || 'AI verification failed.');
    } catch (aiErr) {
      console.error(`[Worker] AI Service error:`, aiErr.message);
      errors.push('AI service temporarily unavailable.');
    }

    // 3. Upload to ImageKit if verified
    const finalVerified = isVerified && errors.length === 0;
    if (finalVerified) {
      try {
        const uploadResponse = await imagekit.upload({
          file: fs.createReadStream(filePath),
          fileName: fileName,
          folder: type === 'task' ? '/sevasetu/tasks' : '/sevasetu/needs'
        });
        imageUrl = uploadResponse.url;
      } catch (ikErr) {
        console.error(`[Worker] ImageKit upload failed:`, ikErr.message);
        errors.push('Failed to save image to cloud storage.');
      }
    }

    // 4. Update Database
    if (type === 'incident') {
      const currentNeed = await prisma.need.findUnique({ where: { id } });
      const newScore = calculateScore({
        need_type: currentNeed.needType,
        people_affected: currentNeed.peopleAffected,
        is_verified: finalVerified
      });

      await prisma.need.update({
        where: { id },
        data: {
          status: finalVerified ? 'open' : 'rejected',
          imageUrl: imageUrl,
          isVerified: finalVerified,
          urgencyScore: newScore,
            verificationResult: {
              verified: finalVerified,
              errors,
              geoTag: geoTagPassed ? 'PASSED' : 'FAILED',
              aiContent: isVerified ? 'PASSED' : 'FAILED'
            }
        }
      });

      if (finalVerified) {
        try {
          const { triggerBroadcast } = require('../services/matchingService');
          await triggerBroadcast(id, 6);
        } catch (e) { console.error('[Worker] Dispatch failed:', e.message); }
      }
    } else if (type === 'task') {
      await prisma.$transaction(async (tx) => {
        const task = await tx.task.update({
          where: { id },
          data: {
            status: finalVerified ? 'completed' : 'in_progress',
            completionImageUrl: imageUrl,
            completedAt: finalVerified ? new Date() : null,
            isCompletionVerified: finalVerified,
            verificationResult: {
              verified: finalVerified,
              errors,
              geoTag: geoTagPassed ? 'PASSED' : 'FAILED',
              aiContent: isVerified ? 'PASSED' : 'FAILED'
            }
          }
        });

        if (finalVerified) {
          await tx.need.update({ where: { id: task.needId }, data: { status: 'completed' } });
          const vol = await tx.volunteer.findUnique({ where: { userId: task.assignedVolunteerId } });
          if (vol) {
            await tx.volunteer.update({
              where: { userId: task.assignedVolunteerId },
              data: { 
                tasksCompleted: (vol.tasksCompleted || 0) + 1,
                completionRate: Math.min(1.0, (vol.completionRate || 0) + 0.10)
              }
            });
          }
        }
      });
    }

  } catch (err) {
    console.error(`[Worker] Job failed:`, err);
  } finally {
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
  }
}, { connection, concurrency: 5 });

module.exports = aiWorker;
