const bcrypt = require('bcrypt');

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
exports.seed = async function (knex) {
  // ── Clean existing data (reverse FK order) ─────────────────────────
  await knex('tasks').del();
  await knex('needs').del();
  await knex('volunteers').del();
  await knex('users').del();
  await knex('organizations').del();

  const SALT_ROUNDS = 10;
  const passwordHash = await bcrypt.hash('sevasetu123', SALT_ROUNDS);

  // ── 1. Organization ────────────────────────────────────────────────
  const [org] = await knex('organizations')
    .insert({
      name: 'Kolkata Relief Network',
      contact_email: 'admin@kolkatareliefnetwork.org',
      district: 'Kolkata',
    })
    .returning('id');
  const orgId = org.id || org;

  // ── 2. Users ───────────────────────────────────────────────────────
  // 2a. Coordinator
  const [coordinator] = await knex('users')
    .insert({
      name: 'Ananya Mukherjee',
      email: 'ananya@sevasetu.org',
      password_hash: passwordHash,
      role: 'coordinator',
      org_id: orgId,
    })
    .returning('id');
  const coordinatorId = coordinator.id || coordinator;

  // 2b. Field Worker
  const [fieldWorker] = await knex('users')
    .insert({
      name: 'Ravi Sharma',
      email: 'ravi@sevasetu.org',
      password_hash: passwordHash,
      role: 'field_worker',
      org_id: orgId,
    })
    .returning('id');
  const fieldWorkerId = fieldWorker.id || fieldWorker;

  // 2c. 10 Volunteers — varied skills & locations around Kolkata
  const volunteerData = [
    { name: 'Priya Das',        email: 'priya@gmail.com',    skills: ['medical', 'counseling'],             lat: 22.5726, lng: 88.3639 },
    { name: 'Suresh Mondal',    email: 'suresh@gmail.com',   skills: ['logistics', 'driving'],              lat: 22.5448, lng: 88.3426 },
    { name: 'Deepa Sen',        email: 'deepa@gmail.com',    skills: ['medical', 'first_aid'],              lat: 22.5958, lng: 88.3697 },
    { name: 'Amit Roy',         email: 'amit@gmail.com',     skills: ['construction', 'logistics'],         lat: 22.5205, lng: 88.3814 },
    { name: 'Kavita Ghosh',     email: 'kavita@gmail.com',   skills: ['teaching', 'counseling'],            lat: 22.5839, lng: 88.3491 },
    { name: 'Rajesh Banerjee',  email: 'rajesh@gmail.com',   skills: ['medical', 'logistics', 'driving'],   lat: 22.5669, lng: 88.3505 },
    { name: 'Sneha Patel',      email: 'sneha@gmail.com',    skills: ['cooking', 'distribution'],           lat: 22.5362, lng: 88.3595 },
    { name: 'Bikash Saha',      email: 'bikash@gmail.com',   skills: ['logistics', 'construction'],         lat: 22.6103, lng: 88.4004 },
    { name: 'Meera Chakraborty',email: 'meera@gmail.com',    skills: ['medical', 'teaching'],               lat: 22.5480, lng: 88.3720 },
    { name: 'Arjun Singh',      email: 'arjun@gmail.com',    skills: ['driving', 'first_aid', 'logistics'], lat: 22.5017, lng: 88.3265 },
  ];

  const volunteerUserIds = [];

  for (const v of volunteerData) {
    const [user] = await knex('users')
      .insert({
        name: v.name,
        email: v.email,
        password_hash: passwordHash,
        role: 'volunteer',
        org_id: orgId,
      })
      .returning('id');
    const userId = user.id || user;
    volunteerUserIds.push(userId);

    await knex('volunteers').insert({
      user_id: userId,
      skills: v.skills,
      is_available: true,
      tasks_completed: Math.floor(Math.random() * 20),
      completion_rate: +(0.6 + Math.random() * 0.4).toFixed(2),
    });

    // Set PostGIS location
    await knex.raw(
      `UPDATE volunteers SET location = ST_SetSRID(ST_MakePoint(?, ?), 4326) WHERE user_id = ?`,
      [v.lng, v.lat, userId]
    );
  }

  // ── 3. Needs — 20 community needs across Kolkata wards ─────────────
  const needsData = [
    { title: 'Flood victims need medical aid',           need_type: 'medical',    ward: 'Ward 64',  district: 'Kolkata', people_affected: 150, urgency_score: 9.2,  status: 'open',        is_disaster_zone: true,  lat: 22.5726, lng: 88.3639 },
    { title: 'Food supply depleted in shelter',          need_type: 'food',       ward: 'Ward 58',  district: 'Kolkata', people_affected: 80,  urgency_score: 8.5,  status: 'open',        is_disaster_zone: true,  lat: 22.5448, lng: 88.3426 },
    { title: 'Temporary shelter collapse risk',          need_type: 'shelter',    ward: 'Ward 72',  district: 'Kolkata', people_affected: 45,  urgency_score: 7.8,  status: 'open',        is_disaster_zone: true,  lat: 22.5958, lng: 88.3697 },
    { title: 'Children need tutoring materials',         need_type: 'education',  ward: 'Ward 41',  district: 'Kolkata', people_affected: 30,  urgency_score: 3.2,  status: 'open',        is_disaster_zone: false, lat: 22.5205, lng: 88.3814 },
    { title: 'Elderly need medication delivery',         need_type: 'medical',    ward: 'Ward 33',  district: 'Kolkata', people_affected: 12,  urgency_score: 7.1,  status: 'assigned',    is_disaster_zone: false, lat: 22.5839, lng: 88.3491 },
    { title: 'Community kitchen supplies running low',   need_type: 'food',       ward: 'Ward 45',  district: 'Kolkata', people_affected: 200, urgency_score: 8.9,  status: 'open',        is_disaster_zone: false, lat: 22.5669, lng: 88.3505 },
    { title: 'Waterlogged area needs pumps',             need_type: 'other',      ward: 'Ward 67',  district: 'Kolkata', people_affected: 500, urgency_score: 9.5,  status: 'open',        is_disaster_zone: true,  lat: 22.5362, lng: 88.3595 },
    { title: 'School building partial damage',           need_type: 'shelter',    ward: 'Ward 28',  district: 'Howrah',  people_affected: 100, urgency_score: 6.4,  status: 'in_progress', is_disaster_zone: false, lat: 22.6103, lng: 88.4004 },
    { title: 'Pregnant women need hospital transport',   need_type: 'medical',    ward: 'Ward 51',  district: 'Kolkata', people_affected: 5,   urgency_score: 9.0,  status: 'open',        is_disaster_zone: false, lat: 22.5480, lng: 88.3720 },
    { title: 'Ration distribution needed at camp',       need_type: 'food',       ward: 'Ward 15',  district: 'Kolkata', people_affected: 300, urgency_score: 8.0,  status: 'open',        is_disaster_zone: true,  lat: 22.5017, lng: 88.3265 },
    { title: 'First aid kits required at relief camp',   need_type: 'medical',    ward: 'Ward 70',  district: 'Kolkata', people_affected: 60,  urgency_score: 7.5,  status: 'open',        is_disaster_zone: true,  lat: 22.5550, lng: 88.3450 },
    { title: 'Blankets needed for night shelter',        need_type: 'shelter',    ward: 'Ward 22',  district: 'Kolkata', people_affected: 40,  urgency_score: 5.5,  status: 'open',        is_disaster_zone: false, lat: 22.5620, lng: 88.3780 },
    { title: 'Mobile medical van required',              need_type: 'medical',    ward: 'Ward 55',  district: 'Kolkata', people_affected: 90,  urgency_score: 8.2,  status: 'open',        is_disaster_zone: false, lat: 22.5300, lng: 88.3550 },
    { title: 'Drinking water purification tablets',      need_type: 'food',       ward: 'Ward 63',  district: 'Kolkata', people_affected: 250, urgency_score: 8.7,  status: 'open',        is_disaster_zone: true,  lat: 22.5780, lng: 88.3410 },
    { title: 'Debris clearance volunteers needed',       need_type: 'other',      ward: 'Ward 48',  district: 'Kolkata', people_affected: 70,  urgency_score: 6.0,  status: 'completed',   is_disaster_zone: false, lat: 22.5900, lng: 88.3600 },
    { title: 'Psychological counseling for survivors',   need_type: 'medical',    ward: 'Ward 37',  district: 'Kolkata', people_affected: 25,  urgency_score: 5.8,  status: 'open',        is_disaster_zone: false, lat: 22.5150, lng: 88.3900 },
    { title: 'Night school volunteers needed',           need_type: 'education',  ward: 'Ward 19',  district: 'Howrah',  people_affected: 35,  urgency_score: 3.0,  status: 'open',        is_disaster_zone: false, lat: 22.6000, lng: 88.3300 },
    { title: 'Tarpaulin sheets for makeshift roofs',     need_type: 'shelter',    ward: 'Ward 60',  district: 'Kolkata', people_affected: 120, urgency_score: 7.3,  status: 'open',        is_disaster_zone: true,  lat: 22.5400, lng: 88.3680 },
    { title: 'Baby formula and diapers at camp',         need_type: 'food',       ward: 'Ward 43',  district: 'Kolkata', people_affected: 15,  urgency_score: 6.8,  status: 'open',        is_disaster_zone: false, lat: 22.5650, lng: 88.3560 },
    { title: 'Road access blocked — need heavy equipment', need_type: 'other',    ward: 'Ward 75',  district: 'Kolkata', people_affected: 400, urgency_score: 9.1,  status: 'open',        is_disaster_zone: true,  lat: 22.5100, lng: 88.3480 },
  ];

  const needIds = [];

  for (const n of needsData) {
    const [need] = await knex('needs')
      .insert({
        title: n.title,
        description: `Reported from ${n.ward}, ${n.district}. ${n.people_affected} people affected.`,
        need_type: n.need_type,
        ward: n.ward,
        district: n.district,
        people_affected: n.people_affected,
        urgency_score: n.urgency_score,
        status: n.status,
        is_disaster_zone: n.is_disaster_zone,
        reported_by: fieldWorkerId,
      })
      .returning('id');
    const needId = need.id || need;
    needIds.push({ id: needId, status: n.status });

    // Set PostGIS location
    await knex.raw(
      `UPDATE needs SET location = ST_SetSRID(ST_MakePoint(?, ?), 4326) WHERE id = ?`,
      [n.lng, n.lat, needId]
    );
  }

  // ── 4. Tasks — 5 tasks in various statuses ─────────────────────────
  // Find the needs that aren't 'open' — these already have status set
  const assignedNeed = needIds.find((n) => n.status === 'assigned');
  const inProgressNeed = needIds.find((n) => n.status === 'in_progress');
  const completedNeed = needIds.find((n) => n.status === 'completed');

  const now = new Date();
  const hoursAgo = (h) => new Date(now.getTime() - h * 60 * 60 * 1000);

  const tasksData = [
    // Task 1: assigned
    {
      need_id: assignedNeed.id,
      assigned_volunteer_id: volunteerUserIds[0],
      status: 'assigned',
      assigned_at: hoursAgo(2),
      notes: 'Volunteer dispatched for medication delivery.',
    },
    // Task 2: in_progress (volunteer checked in)
    {
      need_id: inProgressNeed.id,
      assigned_volunteer_id: volunteerUserIds[3],
      status: 'in_progress',
      assigned_at: hoursAgo(6),
      checked_in_at: hoursAgo(4),
      notes: 'Volunteer on-site assessing structural damage.',
    },
    // Task 3: completed
    {
      need_id: completedNeed.id,
      assigned_volunteer_id: volunteerUserIds[1],
      status: 'completed',
      assigned_at: hoursAgo(24),
      checked_in_at: hoursAgo(22),
      completed_at: hoursAgo(18),
      notes: 'Debris cleared from main road. Access restored.',
    },
    // Task 4: assigned (recent)
    {
      need_id: needIds[5].id, // Community kitchen
      assigned_volunteer_id: volunteerUserIds[6],
      status: 'assigned',
      assigned_at: hoursAgo(1),
      notes: 'Volunteer bringing cooking supplies.',
    },
    // Task 5: in_progress
    {
      need_id: needIds[9].id, // Ration distribution
      assigned_volunteer_id: volunteerUserIds[9],
      status: 'in_progress',
      assigned_at: hoursAgo(5),
      checked_in_at: hoursAgo(3),
      notes: 'Ration distribution underway at relief camp.',
    },
  ];

  await knex('tasks').insert(tasksData);

  console.log('✅ Seed complete:');
  console.log('   - 1 organization');
  console.log('   - 1 coordinator (ananya@sevasetu.org / sevasetu123)');
  console.log('   - 1 field worker (ravi@sevasetu.org / sevasetu123)');
  console.log('   - 10 volunteers (priya@gmail.com ... / sevasetu123)');
  console.log('   - 20 needs across Kolkata wards');
  console.log('   - 5 tasks in various statuses');
};
