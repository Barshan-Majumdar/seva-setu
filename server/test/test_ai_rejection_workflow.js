const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const prisma = require('../src/config/db');
const { aiVerificationQueue } = require('../src/config/queue');

async function testRejectionWorkflow() {
  console.log('=== TEST 1: REJECTION ON BOGUS/BLANK IMAGE ===');

  // Create a minimal 1x1 white JPEG simulating a blank wall/screen
  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const blankImagePath = path.join(uploadsDir, 'blank_fake.jpg');
  const base64Jpg = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  fs.writeFileSync(blankImagePath, Buffer.from(base64Jpg, 'base64'));

  const need = await prisma.need.create({
    data: {
      title: 'Massive Building Collapse and Fire with People Trapped',
      description: 'Major building collapse, active fire and casualties',
      needType: 'rescue',
      ward: 'Ward 25',
      district: 'Kolkata',
      peopleAffected: 20,
      urgencyScore: 9.5,
      isVerified: false,
      status: 'pending'
    }
  });

  console.log(`Created test emergency: ${need.id} (Status: ${need.status})`);

  // Enqueue verification job
  await aiVerificationQueue.add('verify-incident', {
    type: 'incident',
    id: need.id,
    localPath: blankImagePath,
    fileName: 'blank_fake.jpg',
    metadata: { lat: 22.5726, lng: 88.3639 }
  });

  console.log('Job enqueued. Waiting for AI verification to complete...');

  let finalRecord = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 800));
    finalRecord = await prisma.need.findUnique({ where: { id: need.id } });
    if (finalRecord.status !== 'pending') break;
  }

  console.log(`Result status: ${finalRecord.status}`);
  console.log(`isVerified: ${finalRecord.isVerified}`);
  console.log(`RejectionReason: ${finalRecord.rejectionReason}`);
  console.log(`VerificationResult:`, JSON.stringify(finalRecord.verificationResult));

  // Clean up
  await prisma.need.delete({ where: { id: need.id } });
  if (fs.existsSync(blankImagePath)) fs.unlinkSync(blankImagePath);

  if (finalRecord.status === 'rejected' && !finalRecord.isVerified) {
    console.log('✅ TEST 1 PASSED: AI accurately REJECTED the fake image! Status is REJECTED!');
  } else {
    console.error('❌ TEST 1 FAILED: Need was NOT rejected! Status is:', finalRecord.status);
    process.exit(1);
  }
}

testRejectionWorkflow()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

