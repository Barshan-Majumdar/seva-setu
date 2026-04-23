/**
 * Migration 004 — Create needs table
 * Community needs reported by field workers / coordinators.
 * Includes PostGIS location, urgency scoring, and status tracking.
 */
exports.up = async function (knex) {
  // Create the need_type enum
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE need_type AS ENUM ('medical', 'food', 'shelter', 'education', 'other');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // Create the need_status enum
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE need_status AS ENUM ('open', 'assigned', 'in_progress', 'completed');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await knex.schema.createTable('needs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('title').notNullable();
    table.text('description');
    table.specificType('need_type', 'need_type').notNullable();
    // PostGIS location column added via raw SQL below
    table.string('ward');
    table.string('district');
    table.integer('people_affected').defaultTo(0);
    table.float('urgency_score').defaultTo(1.0);
    table.specificType('status', 'need_status').notNullable().defaultTo('open');
    table.boolean('is_disaster_zone').defaultTo(false);
    table
      .uuid('reported_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // Add the PostGIS geometry column for need location
  await knex.raw(`
    SELECT AddGeometryColumn('needs', 'location', 4326, 'POINT', 2);
  `);

  // Create GIST spatial index on the location column
  await knex.raw(`
    CREATE INDEX idx_needs_location ON needs USING GIST(location);
  `);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('needs');
  await knex.raw('DROP TYPE IF EXISTS need_type;');
  await knex.raw('DROP TYPE IF EXISTS need_status;');
};
