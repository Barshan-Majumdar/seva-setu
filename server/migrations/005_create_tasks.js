/**
 * Migration 005 — Create tasks table
 * Links a need to an assigned volunteer, tracking the full task lifecycle:
 * assigned → checked_in → completed.
 */
exports.up = async function (knex) {
  // Create task_status enum (mirrors need_status)
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE task_status AS ENUM ('assigned', 'in_progress', 'completed');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await knex.schema.createTable('tasks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('need_id')
      .notNullable()
      .references('id')
      .inTable('needs')
      .onDelete('CASCADE');
    table
      .uuid('assigned_volunteer_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.specificType('status', 'task_status').notNullable().defaultTo('assigned');
    table.timestamp('assigned_at').defaultTo(knex.fn.now());
    table.timestamp('checked_in_at');
    table.timestamp('completed_at');
    table.text('notes');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('tasks');
  await knex.raw('DROP TYPE IF EXISTS task_status;');
};
