'use strict';

const path = require('path');
// const stream = require('stream');
const sumo = require('@mapbox/sumo');
const utils = require('./utils');

const accessId = process.env.MAPBOX_CLI_SUMOLOGIC_ACCESS_ID;
const accessKey = process.env.MAPBOX_CLI_SUMOLOGIC_ACCESS_KEY;

const readOutputFile = (tokensFile) => {
  return utils.readFile(tokensFile)
    .then((data) => {
      return data.trim().split('\n').slice(1).map((row) => {
        row = row.replace(/"/g, '').split(',');
        return {
          token: row[0],
          count: Number(row[1])
        };
      });
    });
};

const query = (regions) => {
  regions = regions || ['ap-northeast-1', 'ap-southeast-1'];
  const where = regions
    // .map((r) => `_sourceCategory = api-maps-production*${r}*`)
    .map((r) => `region = "${r}"`)
    .join(' OR ');

  return utils.formatQuery(`
    _sourceCategory="AWS_ELB2" stack=api-maps-production
    | where ${where}
    | parse regex "access_token=(?<token>pk[^ &]+) HTTP/1.1"
    | count by token
    | order by _count
  `);

  // return utils.formatQuery(`
  //   ${where}
  //   | parse regex "/50 per 60s by (?<token>\\S+)"
  //   | count by token
  //   | order by _count
  // `);
};

module.exports = (options) => {
  const spinner = utils.spinner('Querying sumologic');

  // const capture = new stream.Writable({
  //   objectMode: true,
  //   write: (data, enc, callback) => {
  //     if (!capture.buffer) capture.buffer = [];
  //     capture.buffer.push(data);
  //     callback();
  //   }
  // });
  //
  // const logs = sumo.createReadStream('records', {
  //   query: query(options.regions),
  //   from: Date.now() - 2 * 60 * 60 * 1000,
  //   to: Date.now(),
  //   auth: { accessId, accessKey }
  // });
  //
  // return new Promise((resolve, reject) => {
  //   capture.on('finish', () => resolve(capture.buffer));
  //   capture.on('error', (err) => reject(err));
  //   logs.on('error', (err) => reject(err));
  //   logs.pipe(capture);
  // })

  return sumo
    .search({
      query: query(options.regions),
      from: Date.now() - 2 * 60 * 60 * 1000,
      to: Date.now(),
      auth: { accessId, accessKey }
    })
    .then((data) => data.records.map((record) => ({
      token: record.token,
      count: record._count
    })))
    .then((data) => Promise.all([
      data,
      utils.writeFile(path.resolve(options.outputFolder, 'sumo-output.txt'), data)
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

module.exports.readOutputFile = readOutputFile;
