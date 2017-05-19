'use strict';

const url = require('url');
const path = require('path');
const fs = require('fs');
const pg = require('pg');
const redent = require('redent');
const trimNewlines = require('trim-newlines');
const Spinner = require('cli-spinner').Spinner;
const mkdirp = require('mkdirp');

const formatQuery = (query, indentation) => redent(trimNewlines(query), indentation);

const createFolder = (folderPath) => new Promise((resolve, reject) => {
  mkdirp(folderPath, (err) => {
    if (err) return reject(err);
    resolve();
  });
});

const readFile = (filePath) => new Promise((resolve, reject) => {
  fs.readFile(path.resolve(filePath), 'utf8', (err, data) => {
    if (err) return reject(err);
    resolve(data);
  });
});

const writeFile = (filePath, data) => new Promise((resolve, reject) => {
  data = data.map((d) => JSON.stringify(d)).join('\n');
  fs.writeFile(path.resolve(filePath), data, (err) => {
    if (err) return reject(err);
    resolve();
  });
});

const spinner = (message) => {
  const spin = new Spinner(`${message}...`);
  spin.setSpinnerString('⠄⠆⠇⠋⠙⠸⠰⠠⠰⠸⠙⠋⠇⠆');
  spin.start();
  return spin;
};

const askPostgres = (uri, query) => {
  uri = url.parse(uri);
  const pool = new pg.Pool({
    user: uri.auth.split(':')[0],
    password: uri.auth.split(':')[1],
    host: uri.hostname,
    port: uri.port,
    database: uri.path.slice(1)
  });

  return new Promise((resolve, reject) => {
    pool.connect((err, client, done) => {
      if (err) return reject(err);

      client.query(query, (err, result) => {
        done();

        if (err) return reject(err);

        const rows = result.rows.map((row) => {
          if (row.useragent) row.useragent = row.useragent
            .replace(/%2520/g, ' ') // double-encoded
            .replace(/%252F/g, '/') // double-encoded
            .replace(/%252$/g, '')  // this is a cut-off double-encoding of ' ('
            .replace(/%2F/g, '/');  // single-encoded
          return row;
        });

        resolve(rows);
      });
    });
  });
};

module.exports = {
  askPostgres,
  createFolder,
  formatQuery,
  readFile,
  spinner,
  writeFile
};
