'use strict';

const got = require('got');
const Queue = require('p-queue');
const utils = require('./utils');

const lookupOne = (ip) => {
  return got.get(`http://ipinfo.io/${ip}/org`)
    .then((data) => data.body.trim());
};

module.exports = (ips) => {
  const spinner = utils.spinner('Looking up orgs for IP addresses');
  const queue = new Queue({ concurrency: 10 });
  const requests = ips.map((ip) => queue.add(() => lookupOne(ip)));
  return Promise.all(requests)
    .then((data) => {
      spinner.stop(true);
      return Array.from(new Set(data));
    })
    .catch((err) => {
      spinner.stop(true);
      throw err;
    });
};

// If you enable this, you can lookup the owner orgs for a set of IP addresses in
// a line-delimited file, one ip per line
// utils.readFile(process.argv[2])
//   .then((data) => module.exports(data.trim().split('\n')))
//   .then((data) => console.log(data));
