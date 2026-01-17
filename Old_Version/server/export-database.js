#!/usr/bin/env node

/**
 * Database Export Script
 * Exports both schema and data from the SPWMS database
 */

const { Sequelize, DataType } = require('sequelize-typescript');
const fs = require('fs');
const path = require('path');

// Import models using CommonJS from dist directory
const { User } = require('./dist/models/User.model');
const { Course } = require('./dist/models/Course.model');
const { Assignment } = require('./dist/models/Assignment.model');
const { Submission } = require('./dist/models/Submission.model');
const { UserCourse } = require('./dist/models/UserCourse.model');

// Database configuration
const sequelize = new Sequelize({
  database: 'spwms_dev',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  host: process.env.DB_HOST || 'localhost',
  dialect: 'mysql',
  logging: console.log,
  models: [User, Course, Assignment, Submission, UserCourse]
});

async function exportDatabaseSchema() {
  const schema = {};

  for (const model of [User, Course, Assignment, Submission, UserCourse]) {
    try {
      const tableName = model.tableName;
      console.log(`Exporting schema for table: ${tableName}`);

      // Get table description
      const describeResult = await sequelize.getQueryInterface().describeTable(tableName);

      // Get indexes
      const indexes = await sequelize.getQueryInterface().showIndex(tableName);

      schema[tableName] = {
        name: tableName,
        columns: Object.entries(describeResult).map(([name, config]) => ({
          name,
          type: config.type?.toString() || 'UNKNOWN',
          allowNull: config.allowNull,
          defaultValue: config.defaultValue,
          primaryKey: config.primaryKey,
          autoIncrement: config.autoIncrement,
          unique: config.unique,
          comment: config.comment
        })),
        indexes: indexes.map(index => ({
          name: index.Key_name,
          unique: index.Non_unique === 0,
          columns: index.Column_name,
          type: index.Index_type
        }))
      };
    } catch (error) {
      console.error(`Error exporting schema for ${model.tableName}:`, error);
    }
  }

  return schema;
}

async function exportTableData() {
  const data = {};

  for (const model of [User, Course, Assignment, Submission, UserCourse]) {
    try {
      const tableName = model.tableName;
      console.log(`Exporting data for table: ${tableName}`);

      const records = await model.findAll({
        raw: true,
        nest: true
      });

      // Remove sensitive data like passwords
      if (tableName === 'users') {
        data[tableName] = records.map((record) => {
          const { password, reset_password_token, reset_password_expire, ...cleanRecord } = record;
          return cleanRecord;
        });
      } else {
        data[tableName] = records;
      }

      console.log(`Exported ${records.length} records from ${tableName}`);
    } catch (error) {
      console.error(`Error exporting data for ${model.tableName}:`, error);
      data[model.tableName] = [];
    }
  }

  return data;
}

async function createExportDirectory() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const exportDir = path.join(__dirname, `database-export-${timestamp}`);

  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  return exportDir;
}

async function saveSchemaToFile(schema, exportDir) {
  const schemaFile = path.join(exportDir, 'schema.json');

  // Convert schema to a more readable format
  const readableSchema = Object.entries(schema).map(([tableName, tableInfo]) => ({
    table_name: tableName,
    columns: tableInfo.columns.map(col => ({
      name: col.name,
      type: col.type,
      nullable: col.allowNull,
      default: col.defaultValue,
      primary_key: col.primaryKey,
      auto_increment: col.autoIncrement,
      unique: col.unique,
      comment: col.comment
    })),
    indexes: tableInfo.indexes,
    sql_create_statement: generateCreateTableSQL(tableName, tableInfo)
  }));

  fs.writeFileSync(schemaFile, JSON.stringify(readableSchema, null, 2));
  console.log(`Schema exported to: ${schemaFile}`);
}

function generateCreateTableSQL(tableName, tableInfo) {
  const columns = tableInfo.columns.map(col => {
    let sql = `  ${col.name} ${col.type}`;

    if (!col.allowNull) sql += ' NOT NULL';
    if (col.primaryKey) sql += ' PRIMARY KEY';
    if (col.autoIncrement) sql += ' AUTO_INCREMENT';
    if (col.unique) sql += ' UNIQUE';

    return sql;
  }).join(',\n');

  return `CREATE TABLE ${tableName} (\n${columns}\n);`;
}

async function saveDataToFiles(data, exportDir) {
  // Save all data to a single JSON file
  const dataFile = path.join(exportDir, 'data.json');
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  console.log(`Data exported to: ${dataFile}`);

  // Also create individual CSV files for easier import
  for (const [tableName, records] of Object.entries(data)) {
    if (records.length === 0) continue;

    const csvFile = path.join(exportDir, `${tableName}.csv`);
    const headers = Object.keys(records[0]);
    const csvContent = [
      headers.join(','),
      ...records.map(record =>
        headers.map(header => {
          const value = record[header];
          // Handle null values and escape commas/quotes in CSV
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      )
    ].join('\n');

    fs.writeFileSync(csvFile, csvContent);
    console.log(`CSV data exported to: ${csvFile} (${records.length} records)`);
  }
}

async function main() {
  try {
    console.log('Starting database export...');

    // Test database connection
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Create export directory
    const exportDir = await createExportDirectory();
    console.log(`Export directory created: ${exportDir}`);

    // Export schema
    console.log('\n--- Exporting Database Schema ---');
    const schema = await exportDatabaseSchema();
    await saveSchemaToFile(schema, exportDir);

    // Export data
    console.log('\n--- Exporting Database Data ---');
    const data = await exportTableData();

    // Calculate metadata
    const totalRecords = Object.values(data).reduce((sum, records) => sum + records.length, 0);

    // Save complete export metadata
    const metadataFile = path.join(exportDir, 'export-metadata.json');
    const metadata = {
      exported_at: new Date().toISOString(),
      database_name: sequelize.getDatabaseName(),
      total_tables: Object.keys(schema).length,
      total_records: totalRecords
    };
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));

    await saveDataToFiles(data, exportDir);

    console.log('\n=== Export Complete ===');
    console.log(`Exported ${Object.keys(schema).length} tables`);
    console.log(`Exported ${totalRecords} total records`);
    console.log(`Export location: ${exportDir}`);
    console.log('\nFiles created:');
    console.log('- schema.json (table definitions)');
    console.log('- data.json (all data)');
    console.log('- export-metadata.json (summary)');
    console.log('- Individual CSV files for each table');

  } catch (error) {
    console.error('Export failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the export
main();
