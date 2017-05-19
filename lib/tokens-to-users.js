'use strict';

const path = require('path');
const got = require('got');
const Queue = require('p-queue');
const utils = require('./utils');
const adminToken = process.env.MapboxAccessToken;

const lookupOne = (token) => {
  if (/&/.test(token)) return Promise.resolve(null);
  const url = `https://api-core-production.mapbox.com/api/User/search/${token}?access_token=${adminToken}`;
  return got.get(url, { json: true }).then((data) => {
    if (!data.body[0]) return null;

    return {
      token,
      id: data.body[0].id,
      accountLevel: data.body[0].accountLevel
    };
  });
};

module.exports = (outputFolder, tokens) => {
  const spinner = utils.spinner('Looking up users in api-core');
  const queue = new Queue({ concurrency: 10 });
  const requests = tokens.map((token) => queue.add(() => lookupOne(token)));
  return Promise.all(requests)
    .then((results) => results.filter((r) => !!r))
    .then((data) => Promise.all([
      data,
      utils.writeFile(path.join(outputFolder, 'user-lookups.txt'), data)
    ]))
    .then((results) => {
      spinner.stop(true);
      return results[0];
    })
    .catch((err) => {
      spinner.stop(true);
      throw err;
    });
};


If you enable this, you can pull a file that is just line-delimited access tokens
and look up all the users from that file
utils.readFile(process.argv[2])
  .then((data) => module.exports('tokens', data.trim().replace(/\r/g, '').split('\n')))
  .then((data) => console.log(data));
