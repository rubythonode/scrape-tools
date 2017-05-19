'use strict';

const path = require('path');
const fs = require('fs');
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

module.exports = {
  createFolder,
  formatQuery,
  readFile,
  spinner,
  writeFile
};
