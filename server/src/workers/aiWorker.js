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
const redisService = require('../services/redisService');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

const aiWorker = new Worker('ai-verification', async (job) => {
  const { type, id, imageUrl, localPath, fileName, metadata } = job.data;
  console.log(`[Worker] Processing ${type} job for ID: ${id}`);

  let errors = [];
  let isVerified = false;
  let finalImageUrl = imageUrl || null; 
  let photoHasGps = false;
  let geoTagPassed = false;

  try {
    // --- 0. Read image to Buffer (from local disk or URL) ---
    let imageBuffer;
    if (localPath && fs.existsSync(localPath)) {
      imageBuffer = fs.readFileSync(localPath);
    } else if (imageUrl) {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(response.data);
    } else {
      throw new Error('No image path or URL provided');
    }

    // 0.5. Fetch Issue Title for contextual AI analysis
    let issueTitle = '';
    let currentNeed = null;
    if (type === 'incident') {
      currentNeed = await prisma.need.findUnique({ where: { id } });
      if (currentNeed) issueTitle = currentNeed.title || currentNeed.needType;
    } else if (type === 'task') {
      const task = await prisma.task.findUnique({ where: { id }, include: { need: true } });
      if (task && task.need) issueTitle = task.need.title || task.need.needType;
    }

    // 1. GPS Check (using buffer)
    if (metadata && metadata.lat && metadata.lng) {
      try {
        const exifrData = await exifr.parse(imageBuffer, { gps: true });
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
        } else {
          // Strict EXIF check requirement
          errors.push('Image must be geotagged (contain EXIF GPS data).');
        }
      } catch (e) {
        console.error(`[Worker] GPS check failed: ${e.message}`);
        errors.push('Failed to parse EXIF GPS data. Image must be geotagged.');
      }
    } else {
      errors.push('Missing location metadata for verification.');
    }

    // 2. AI Content Check (using buffer, ONLY if EXIF GPS passed the distance check)
    if (geoTagPassed) {
      try {
        // Fast pre-check (2s timeout) to verify AI service is online before sending large image payloads
        try {
          await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 2000 });
        } catch (healthErr) {
          throw new Error('AI service is offline or unreachable.');
        }

        const form = new FormData();
        form.append('file', imageBuffer, { filename: fileName });
        form.append('upload_type', type === 'task' ? 'PROOF_OF_RELIEF' : 'ISSUE_REGISTRATION');
        if (issueTitle) {
          form.append('issue_title', issueTitle);
        }

        const aiResponse = await axios.post(`${AI_SERVICE_URL}/verify-image`, form, {
          headers: form.getHeaders(),
          timeout: 10000
        });

        if (aiResponse.data.is_verified) isVerified = true;
        else errors.push(aiResponse.data.reason || 'AI verification failed.');
      } catch (aiErr) {
        console.error(`[Worker] AI Service error:`, aiErr.message);
        errors.push('AI service temporarily unavailable.');
      }
    } else {
      isVerified = false;
    }

    // 3. Status Finalization
    const finalVerified = isVerified && errors.length === 0;

    // --- 3.1 IMMEDIATE Database Update (Instant UI Feedback) ---
    if (type === 'incident') {
      if (!currentNeed) {
        currentNeed = await prisma.need.findUnique({ where: { id } });
      }
      const newScore = calculateScore({
        need_type: currentNeed.needType,
        people_affected: currentNeed.peopleAffected,
        is_verified: finalVerified
      });

      await prisma.need.update({
        where: { id },
        data: {
          isVerified: finalVerified,
          status: finalVerified ? 'open' : 'rejected',
          urgencyScore: newScore,
          verificationResult: {
            verified: finalVerified,
            errors,
            geoTag: geoTagPassed ? 'PASSED' : 'FAILED',
            aiContent: isVerified ? 'PASSED' : 'FAILED'
          }
        }
      });
      redisService.clearCache('/api/needs').catch(() => {});

      if (global.io) {
        global.io.emit('need_updated', { id, status: finalVerified ? 'open' : 'rejected' });
      }

      if (finalVerified) {
        try {
          const { triggerBroadcast } = require('../services/matchingService');
          await triggerBroadcast(id, 2);
          await redisService.addToSet('needs_to_rebroadcast', id);
        } catch (e) { console.error('[Worker] Dispatch failed:', e.message); }
      }
    } else if (type === 'task') {
      let updatedTask = null;
      await prisma.$transaction(async (tx) => {
        updatedTask = await tx.task.update({
          where: { id },
          data: {
            status: finalVerified ? 'completed' : 'in_progress',
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
          await tx.need.update({ where: { id: updatedTask.needId }, data: { status: 'completed' } });
          const vol = await tx.volunteer.findUnique({ where: { userId: updatedTask.assignedVolunteerId } });
          if (vol) {
            await tx.volunteer.update({
              where: { userId: updatedTask.assignedVolunteerId },
              data: { 
                tasksCompleted: (vol.tasksCompleted || 0) + 1,
                completionRate: Math.min(1.0, (vol.completionRate || 0) + 0.10)
              }
            });
          }
        }
      });
      redisService.clearCache('/api/tasks').catch(() => {});
      redisService.clearCache('/api/tasks/my').catch(() => {});
      redisService.clearCache('/api/needs').catch(() => {});
      redisService.clearCache('/api/volunteers').catch(() => {});
      redisService.clearCache('/api/volunteers/me/stats').catch(() => {});
      redisService.clearCache('/api/coordinators/stats').catch(() => {});

      if (global.io && updatedTask) {
        global.io.emit('task_updated', { id, status: finalVerified ? 'completed' : 'in_progress' });
        if (finalVerified) {
          global.io.emit('need_updated', { id: updatedTask.needId, status: 'completed' });
        }
      }
    }

    // --- 3.5. Background ImageKit Upload & Secondary DB Update ---
    if (localPath && fs.existsSync(localPath)) {
      if (geoTagPassed) {
        try {
          const uploadResponse = await imagekit.upload({
            file: imageBuffer,
            fileName: fileName,
            folder: type === 'incident' ? '/sevasetu/needs' : '/sevasetu/tasks'
          });
          finalImageUrl = uploadResponse.url;

          // Secondary DB update just for the image URL
          if (type === 'incident') {
            await prisma.need.update({
              where: { id },
              data: { imageUrl: finalImageUrl }
            });
            redisService.clearCache('/api/needs').catch(() => {});
          } else if (type === 'task') {
            await prisma.task.update({
              where: { id },
              data: { completionImageUrl: finalImageUrl }
            });
            redisService.clearCache('/api/tasks').catch(() => {});
          }
        } catch (e) {
          console.error('[Worker] ImageKit upload failed:', e);
          errors.push('Image upload to cloud storage failed.');
          finalImageUrl = null;
        }
      }
      
      // ALWAYS delete the local temp file to prevent disk leaks
      try {
        fs.unlinkSync(localPath);
      } catch (e) {
        console.error('[Worker] Failed to delete local file:', e.message);
      }
    }

  } catch (err) {
    console.error(`[Worker] Job failed:`, err);
  }
}, { connection, concurrency: 5 });

module.exports = aiWorker;
