'use strict';

const got = require('got');
const Queue = require('p-queue');
const utils = require('./utils');

const wafRanges = (ips) => {
  // Convert all ranges to waf-compatible IP ranges
  // "AWS WAF supports /8, /16, /24, and /32 IPv4 address ranges." -- http://docs.aws.amazon.com/waf/latest/developerguide/web-acl-ip-conditions.html
  const wafips = ips
  .reduce((memo, ip) => {
    if (/\/(8|16|24|32)/.test(ip)) {
      memo[ip] = true;
    } else {
      const range = parseInt(ip.split('/').pop());
      if (range < 16) {
        const parsed = ip.split('.');
        for (let i = 0; i < Math.pow(2, (16 - range)); i++) {
          const a = parsed.slice(0,1).concat([parseInt(parsed[1],10) + i]).concat([0,0]);
          memo[`${a.join('.')}/16`] = true;
        }
      // Greedy -- smooshes ranges > /16 to /16
      // If we were to expand these to /24's we'll blow through the waf IP limit
      } else if (range > 16) {
        const parsed = ip.split('.');
        const a = parsed.slice(0,2).concat([0,0]);
        memo[`${a.join('.')}/16`] = true;
      }
    }
    return memo;
  }, []);

  // Unique-ify and sort
  return Object.keys(wafips).sort();
};

const lookupOne = (url) => {
  return got.get(url).then((response) => {
    const ips = response.body.match(/\d+\.\d+\.\d+\.\d+\/\d+/g);
    return wafRanges(ips);
  });
};

module.exports = (urls) => {
  const spinner = utils.spinner('Looking up org IP ranges');
  const queue = new Queue({ concurrency: 10 });
  const requests = urls.map((url) => queue.add(() => lookupOne(url)));
  return Promise.all(requests)
    .then((data) => {
      spinner.stop(true);
      const result = new Set();
      data.forEach((rangeSet) => {
        rangeSet.forEach((range) => result.add(range));
      });
      return Array.from(result);
    })
    .catch((err) => {
      spinner.stop(true);
      throw err;
    });
};


// If you enable this, you can pass it a file that is a JSON array where each
// entry is an output from lookup-ip-owners.js
// utils.readFile(process.argv[2])
//   .then((data) => module.exports(JSON.parse(data).map((d) => {
//     return `http://ipinfo.io/${d.split(' ')[0]}/`;
//   })))
//   .then((data) => console.log(data));
