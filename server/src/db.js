/**
 * Knex database connection instance.
 * Import this wherever you need to run queries.
 */
const knex = require('knex');
const knexConfig = require('../knexfile');

const environment = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[environment]);

module.exports = db;
