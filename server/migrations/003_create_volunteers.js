/**
 * Migration 003 — Create volunteers table
 * Extends users with volunteer-specific fields: skills, PostGIS location,
 * availability, and performance metrics.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('volunteers', (table) => {
    table
      .uuid('user_id')
      .primary()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.specificType('skills', 'TEXT[]').defaultTo('{}');
    // PostGIS geography POINT column added via raw SQL below
    table.boolean('is_available').defaultTo(true);
    table.integer('tasks_completed').defaultTo(0);
    table.float('completion_rate').defaultTo(0.0);
  });

  // Add the PostGIS geometry column for volunteer location
  await knex.raw(`
    SELECT AddGeometryColumn('volunteers', 'location', 4326, 'POINT', 2);
  `);

  // Create GIST spatial index on the location column
  await knex.raw(`
    CREATE INDEX idx_volunteers_location ON volunteers USING GIST(location);
  `);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('volunteers');
};
