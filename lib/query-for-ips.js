'use strict';

const path = require('path');
const url = require('url');
const pg = require('pg');
const utils = require('./utils');

const query = (tokens) => {
  const where = tokens
    .map((token) => `'access_token=${token}'`)
    .join(',\n          ');

  return utils.formatQuery(`
    (
      SELECT
        DISTINCT(cip) AS ip,
        cs_uri_query AS pkey,
        useragent,
        COUNT(*) as cnt
      FROM public.cloudfront_logs_staging_all
      WHERE
        cs_uri_query IN (
          ${where}
        )
        AND TIMESTAMPTZ_CMP(
          CAST ((logdate || ' ' || logtime) AS timestamptz),
          GETDATE() - INTERVAL '1 hours'
        ) = 1
        AND TIMESTAMPTZ_CMP(
          CAST ((logdate || ' ' || logtime) AS timestamptz),
          GETDATE()
        ) = -1
      GROUP BY ip, useragent, pkey
    )
    UNION
    (
      SELECT
        DISTINCT(cip) AS ip,
        cs_uri_query AS pkey,
        useragent,
        COUNT(*) as cnt
      FROM public.cloudfront_logs_all
      WHERE
        cs_uri_query IN (
          ${where}
        )
      GROUP BY ip, useragent, pkey
    )
    ORDER BY ip, cnt DESC
  `);
};

// postgresql://[user[:password]@][netloc][:port][/dbname][?param1=value1&...]
const pool = (uri) => {
  uri = url.parse(uri);
  return new pg.Pool({
    user: uri.auth.split(':')[0],
    password: uri.auth.split(':')[1],
    host: uri.hostname,
    port: uri.port,
    database: uri.path.slice(1)
  });
};

const decodeAgent = (useragent) => useragent
  .replace(/%2520/g, ' ') // double-encoded
  .replace(/%252F/g, '/') // double-encoded
  .replace(/%252$/g, '')  // this is a cut-off double-encoding of ' ('
  .replace(/%2F/g, '/');  // single-encoded

const runQuery = (outputFolder, pool, query) => {
  const spinner = utils.spinner('Querying CloudFront logs');
  return new Promise((resolve, reject) => {
    pool.connect((err, client, done) => {
      if (err) return reject(err);
      client.query(query, (err, result) => {
        done();

        if (err) {
          spinner.stop(true);
          return reject(err);
        }

        const rows = result.rows.map((row) => {
          row.useragent = decodeAgent(row.useragent);
          return row;
        });

        utils.writeFile(path.join(outputFolder, 'ip-query-output.txt'), rows)
          .then(() => {
            spinner.stop(true);
            resolve(rows);
          });
      });
    });
  });
};

const indexRows = (rows) => rows.reduce((index, row) => {
  if (!index[row.ip]) index[row.ip] = {};
  if (!index[row.ip][row.useragent]) index[row.ip][row.useragent] = 0;
  index[row.ip][row.useragent] += Number(row.cnt);
  return index;
}, {});

module.exports = (outputFolder, uri, tokens) => runQuery(outputFolder, pool(uri), query(tokens))
  .then((rows) => indexRows(rows));
