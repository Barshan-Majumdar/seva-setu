const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

/**
 * Seed script for SevaSetu.
 *
 * Creates:
 *  - 1 organization (Kolkata Relief Network)
 *  - 1 coordinator account
 *  - 10 volunteer accounts with varied skills and geo-locations around Kolkata
 *  - 1 field worker account
 *  - 20 sample needs across different Kolkata wards with varied urgency
 *  - 5 tasks in various statuses
 */
async function main() {
  // ── Clean existing data (reverse FK order) ─────────────────────────
  await prisma.task.deleteMany();
  await prisma.need.deleteMany();
  await prisma.volunteer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const SALT_ROUNDS = 10;
  const passwordHash = await bcrypt.hash('sevasetu123', SALT_ROUNDS);

  // ── 1. Organization ────────────────────────────────────────────────
  const org = await prisma.organization.create({
    data: {
      name: 'Kolkata Relief Network',
      contactEmail: 'admin@kolkatareliefnetwork.org',
      district: 'Kolkata',
    },
  });

  // ── 2. Users ───────────────────────────────────────────────────────
  // 2a. Coordinator
  const coordinator = await prisma.user.create({
    data: {
      name: 'Ananya Mukherjee',
      email: 'ananya@sevasetu.org',
      passwordHash,
      role: 'coordinator',
      orgId: org.id,
    },
  });

  // 2b. Field Worker
  const fieldWorker = await prisma.user.create({
    data: {
      name: 'Ravi Sharma',
      email: 'ravi@sevasetu.org',
      passwordHash,
      role: 'field_worker',
      orgId: org.id,
    },
  });

  // 2c. 10 Volunteers — varied skills & locations around Kolkata
  const volunteerData = [
    { name: 'Priya Das',         email: 'priya@gmail.com',   skills: ['medical', 'counseling'],             lat: 22.5726, lng: 88.3639 },
    { name: 'Suresh Mondal',     email: 'suresh@gmail.com',  skills: ['logistics', 'driving'],              lat: 22.5448, lng: 88.3426 },
    { name: 'Deepa Sen',         email: 'deepa@gmail.com',   skills: ['medical', 'first_aid'],              lat: 22.5958, lng: 88.3697 },
    { name: 'Amit Roy',          email: 'amit@gmail.com',    skills: ['construction', 'logistics'],         lat: 22.5205, lng: 88.3814 },
    { name: 'Kavita Ghosh',      email: 'kavita@gmail.com',  skills: ['teaching', 'counseling'],            lat: 22.5839, lng: 88.3491 },
    { name: 'Rajesh Banerjee',   email: 'rajesh@gmail.com',  skills: ['medical', 'logistics', 'driving'],   lat: 22.5669, lng: 88.3505 },
    { name: 'Sneha Patel',       email: 'sneha@gmail.com',   skills: ['cooking', 'distribution'],           lat: 22.5362, lng: 88.3595 },
    { name: 'Bikash Saha',       email: 'bikash@gmail.com',  skills: ['logistics', 'construction'],         lat: 22.6103, lng: 88.4004 },
    { name: 'Meera Chakraborty', email: 'meera@gmail.com',   skills: ['medical', 'teaching'],               lat: 22.5480, lng: 88.3720 },
    { name: 'Arjun Singh',       email: 'arjun@gmail.com',   skills: ['driving', 'first_aid', 'logistics'], lat: 22.5017, lng: 88.3265 },
  ];

  const volunteerUserIds = [];

  for (const v of volunteerData) {
    const user = await prisma.user.create({
      data: {
        name: v.name,
        email: v.email,
        passwordHash,
        role: 'volunteer',
        orgId: org.id,
      },
    });
    volunteerUserIds.push(user.id);

    await prisma.volunteer.create({
      data: {
        userId: user.id,
        skills: v.skills,
        isAvailable: true,
        tasksCompleted: Math.floor(Math.random() * 20),
        completionRate: +(0.6 + Math.random() * 0.4).toFixed(2),
      },
    });

    // Set PostGIS location
    await prisma.$executeRaw`
      UPDATE volunteers SET location = ST_SetSRID(ST_MakePoint(${v.lng}::float, ${v.lat}::float), 4326) WHERE user_id = ${user.id}::uuid
    `;
  }

  // ── 3. Needs — 20 community needs across Kolkata wards ─────────────
  const needsData = [
    { title: 'Flood victims need medical aid',             need_type: 'medical',   ward: 'Ward 64', district: 'Kolkata', people_affected: 150, urgency_score: 9.2,  status: 'open',        is_disaster_zone: true,  lat: 22.5726, lng: 88.3639 },
    { title: 'Food supply depleted in shelter',            need_type: 'food',      ward: 'Ward 58', district: 'Kolkata', people_affected: 80,  urgency_score: 8.5,  status: 'open',        is_disaster_zone: true,  lat: 22.5448, lng: 88.3426 },
    { title: 'Temporary shelter collapse risk',            need_type: 'shelter',   ward: 'Ward 72', district: 'Kolkata', people_affected: 45,  urgency_score: 7.8,  status: 'open',        is_disaster_zone: true,  lat: 22.5958, lng: 88.3697 },
    { title: 'Children need tutoring materials',           need_type: 'education', ward: 'Ward 41', district: 'Kolkata', people_affected: 30,  urgency_score: 3.2,  status: 'open',        is_disaster_zone: false, lat: 22.5205, lng: 88.3814 },
    { title: 'Elderly need medication delivery',           need_type: 'medical',   ward: 'Ward 33', district: 'Kolkata', people_affected: 12,  urgency_score: 7.1,  status: 'assigned',    is_disaster_zone: false, lat: 22.5839, lng: 88.3491 },
    { title: 'Community kitchen supplies running low',     need_type: 'food',      ward: 'Ward 45', district: 'Kolkata', people_affected: 200, urgency_score: 8.9,  status: 'open',        is_disaster_zone: false, lat: 22.5669, lng: 88.3505 },
    { title: 'Waterlogged area needs pumps',               need_type: 'other',     ward: 'Ward 67', district: 'Kolkata', people_affected: 500, urgency_score: 9.5,  status: 'open',        is_disaster_zone: true,  lat: 22.5362, lng: 88.3595 },
    { title: 'School building partial damage',             need_type: 'shelter',   ward: 'Ward 28', district: 'Howrah',  people_affected: 100, urgency_score: 6.4,  status: 'in_progress', is_disaster_zone: false, lat: 22.6103, lng: 88.4004 },
    { title: 'Pregnant women need hospital transport',     need_type: 'medical',   ward: 'Ward 51', district: 'Kolkata', people_affected: 5,   urgency_score: 9.0,  status: 'open',        is_disaster_zone: false, lat: 22.5480, lng: 88.3720 },
    { title: 'Ration distribution needed at camp',         need_type: 'food',      ward: 'Ward 15', district: 'Kolkata', people_affected: 300, urgency_score: 8.0,  status: 'open',        is_disaster_zone: true,  lat: 22.5017, lng: 88.3265 },
    { title: 'First aid kits required at relief camp',     need_type: 'medical',   ward: 'Ward 70', district: 'Kolkata', people_affected: 60,  urgency_score: 7.5,  status: 'open',        is_disaster_zone: true,  lat: 22.5550, lng: 88.3450 },
    { title: 'Blankets needed for night shelter',          need_type: 'shelter',   ward: 'Ward 22', district: 'Kolkata', people_affected: 40,  urgency_score: 5.5,  status: 'open',        is_disaster_zone: false, lat: 22.5620, lng: 88.3780 },
    { title: 'Mobile medical van required',                need_type: 'medical',   ward: 'Ward 55', district: 'Kolkata', people_affected: 90,  urgency_score: 8.2,  status: 'open',        is_disaster_zone: false, lat: 22.5300, lng: 88.3550 },
    { title: 'Drinking water purification tablets',        need_type: 'food',      ward: 'Ward 63', district: 'Kolkata', people_affected: 250, urgency_score: 8.7,  status: 'open',        is_disaster_zone: true,  lat: 22.5780, lng: 88.3410 },
    { title: 'Debris clearance volunteers needed',         need_type: 'other',     ward: 'Ward 48', district: 'Kolkata', people_affected: 70,  urgency_score: 6.0,  status: 'completed',   is_disaster_zone: false, lat: 22.5900, lng: 88.3600 },
    { title: 'Psychological counseling for survivors',     need_type: 'medical',   ward: 'Ward 37', district: 'Kolkata', people_affected: 25,  urgency_score: 5.8,  status: 'open',        is_disaster_zone: false, lat: 22.5150, lng: 88.3900 },
    { title: 'Night school volunteers needed',             need_type: 'education', ward: 'Ward 19', district: 'Howrah',  people_affected: 35,  urgency_score: 3.0,  status: 'open',        is_disaster_zone: false, lat: 22.6000, lng: 88.3300 },
    { title: 'Tarpaulin sheets for makeshift roofs',       need_type: 'shelter',   ward: 'Ward 60', district: 'Kolkata', people_affected: 120, urgency_score: 7.3,  status: 'open',        is_disaster_zone: true,  lat: 22.5400, lng: 88.3680 },
    { title: 'Baby formula and diapers at camp',           need_type: 'food',      ward: 'Ward 43', district: 'Kolkata', people_affected: 15,  urgency_score: 6.8,  status: 'open',        is_disaster_zone: false, lat: 22.5650, lng: 88.3560 },
    { title: 'Road access blocked — need heavy equipment', need_type: 'other',     ward: 'Ward 75', district: 'Kolkata', people_affected: 400, urgency_score: 9.1,  status: 'open',        is_disaster_zone: true,  lat: 22.5100, lng: 88.3480 },
  ];

  const needIds = [];

  for (const n of needsData) {
    const need = await prisma.need.create({
      data: {
        title: n.title,
        description: `Reported from ${n.ward}, ${n.district}. ${n.people_affected} people affected.`,
        needType: n.need_type,
        ward: n.ward,
        district: n.district,
        peopleAffected: n.people_affected,
        urgencyScore: n.urgency_score,
        status: n.status,
        isDisasterZone: n.is_disaster_zone,
        reportedBy: fieldWorker.id,
      },
    });
    needIds.push({ id: need.id, status: n.status });

    // Set PostGIS location
    await prisma.$executeRaw`
      UPDATE needs SET location = ST_SetSRID(ST_MakePoint(${n.lng}::float, ${n.lat}::float), 4326) WHERE id = ${need.id}::uuid
    `;
  }

  // ── 4. Tasks — 5 tasks in various statuses ─────────────────────────
  // Find the needs that aren't 'open' — these already have status set
  const assignedNeed = needIds.find((n) => n.status === 'assigned');
  const inProgressNeed = needIds.find((n) => n.status === 'in_progress');
  const completedNeed = needIds.find((n) => n.status === 'completed');

  const now = new Date();
  const hoursAgo = (h) => new Date(now.getTime() - h * 60 * 60 * 1000);

  // Task 1: assigned
  await prisma.task.create({
    data: {
      needId: assignedNeed.id,
      assignedVolunteerId: volunteerUserIds[0],
      status: 'assigned',
      assignedAt: hoursAgo(2),
      notes: 'Volunteer dispatched for medication delivery.',
    },
  });

  // Task 2: in_progress (volunteer checked in)
  await prisma.task.create({
    data: {
      needId: inProgressNeed.id,
      assignedVolunteerId: volunteerUserIds[3],
      status: 'in_progress',
      assignedAt: hoursAgo(6),
      checkedInAt: hoursAgo(4),
      notes: 'Volunteer on-site assessing structural damage.',
    },
  });

  // Task 3: completed
  await prisma.task.create({
    data: {
      needId: completedNeed.id,
      assignedVolunteerId: volunteerUserIds[1],
      status: 'completed',
      assignedAt: hoursAgo(24),
      checkedInAt: hoursAgo(22),
      completedAt: hoursAgo(18),
      notes: 'Debris cleared from main road. Access restored.',
    },
  });

  // Task 4: assigned (recent)
  await prisma.task.create({
    data: {
      needId: needIds[5].id, // Community kitchen
      assignedVolunteerId: volunteerUserIds[6],
      status: 'assigned',
      assignedAt: hoursAgo(1),
      notes: 'Volunteer bringing cooking supplies.',
    },
  });

  // Task 5: in_progress
  await prisma.task.create({
    data: {
      needId: needIds[9].id, // Ration distribution
      assignedVolunteerId: volunteerUserIds[9],
      status: 'in_progress',
      assignedAt: hoursAgo(5),
      checkedInAt: hoursAgo(3),
      notes: 'Ration distribution underway at relief camp.',
    },
  });

  console.log('✅ Seed complete:');
  console.log('   - 1 organization');
  console.log('   - 1 coordinator (ananya@sevasetu.org / sevasetu123)');
  console.log('   - 1 field worker (ravi@sevasetu.org / sevasetu123)');
  console.log('   - 10 volunteers (priya@gmail.com ... / sevasetu123)');
  console.log('   - 20 needs across Kolkata wards');
  console.log('   - 5 tasks in various statuses');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
