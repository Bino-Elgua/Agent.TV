#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
import logger from '../utils/logger.js';

const { Client } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Database Migration Runner
 * Reads .sql files from migrations/ and executes them
 */
class MigrationRunner {
  constructor() {
    this.connectionString = process.env.DATABASE_URL || 
      'postgresql://user:password@localhost:5432/cryptocall_fm';
    
    this.migrationsDir = path.join(__dirname, '..', 'migrations');
    this.client = null;
  }

  async connect() {
    try {
      this.client = new Client({
        connectionString: this.connectionString
      });
      await this.client.connect();
      logger.info('Connected to PostgreSQL');
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to connect to PostgreSQL');
      throw err;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.end();
      logger.info('Disconnected from PostgreSQL');
    }
  }

  async createMigrationsTable() {
    try {
      await this.client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP DEFAULT NOW()
        )
      `);
      logger.info('Migrations table ready');
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to create migrations table');
      throw err;
    }
  }

  async getExecutedMigrations() {
    try {
      const result = await this.client.query('SELECT name FROM migrations');
      return result.rows.map(row => row.name);
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to fetch migration history');
      return [];
    }
  }

  async getMigrationFiles() {
    try {
      const files = fs.readdirSync(this.migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();
      
      logger.info({ count: files.length }, 'Found migration files');
      return files;
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to read migrations directory');
      return [];
    }
  }

  async executeMigration(filename) {
    try {
      const filepath = path.join(this.migrationsDir, filename);
      const sql = fs.readFileSync(filepath, 'utf8');

      logger.info({ filename }, 'Executing migration');
      
      await this.client.query(sql);
      
      await this.client.query(
        'INSERT INTO migrations (name) VALUES ($1)',
        [filename]
      );

      logger.info({ filename }, 'Migration completed');
      return true;
    } catch (err) {
      logger.error({ filename, error: err.message }, 'Migration failed');
      throw err;
    }
  }

  async run() {
    try {
      await this.connect();
      await this.createMigrationsTable();

      const executed = await this.getExecutedMigrations();
      const files = await this.getMigrationFiles();

      const pending = files.filter(file => !executed.includes(file));

      if (pending.length === 0) {
        logger.info('Database is up to date');
        return;
      }

      logger.info({ count: pending.length }, 'Running pending migrations');

      for (const file of pending) {
        await this.executeMigration(file);
      }

      logger.info('All migrations completed successfully');
    } catch (err) {
      logger.error({ error: err.message }, 'Migration failed');
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// Run if executed directly
const runner = new MigrationRunner();
runner.run().catch(err => {
  logger.error({ error: err.message }, 'Fatal error');
  process.exit(1);
});

