/**
 * Migration 002 — Create users table
 * Central user table with role-based access (coordinator, volunteer, field_worker).
 */
exports.up = async function (knex) {
  // Create the role enum type
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('coordinator', 'volunteer', 'field_worker');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.string('email').notNullable().unique();
    table.string('password_hash').notNullable();
    table.specificType('role', 'user_role').notNullable().defaultTo('volunteer');
    table
      .uuid('org_id')
      .references('id')
      .inTable('organizations')
      .onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('users');
  await knex.raw('DROP TYPE IF EXISTS user_role;');
};
