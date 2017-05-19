'use strict';

const path = require('path');
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

const runQuery = (outputFolder, uri, query) => {
  const spinner = utils.spinner('Querying CloudFront logs');
  return utils.askPostgres(uri, query)
    .then((rows) => {
      spinner.stop(true);
      return utils.writeFile(path.join(outputFolder, 'ip-query-output.txt'), rows)
        .then(() => {
          spinner.stop(true);
          return rows;
        });
    })
    .catch((err) => {
      spinner.stop(true);
      throw err;
    });
};

const indexRows = (rows) => rows.reduce((index, row) => {
  if (!index[row.ip]) index[row.ip] = {};
  if (!index[row.ip][row.useragent]) index[row.ip][row.useragent] = 0;
  index[row.ip][row.useragent] += Number(row.cnt);
  return index;
}, {});

module.exports = (outputFolder, uri, tokens) => runQuery(outputFolder, uri, query(tokens))
  .then((rows) => indexRows(rows));
