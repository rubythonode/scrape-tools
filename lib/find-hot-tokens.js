'use strict';

const path = require('path');
const utils = require('./utils');

const query = (edges) => {
  // SIN, MAA, BOM are popular edges that land in Singapore, NRT in Tokyo
  const where = (edges || ['SIN', 'MAA', 'BOM', 'NRT'])
    .map((edge) => `edge like '${edge}%'`)
    .join(' OR ');

  return utils.formatQuery(`
    SELECT DISTINCT token, cnt
    FROM
      (
        (
          SELECT REGEXP_SUBSTR(cs_uri_query, '(pk|sk)\.[^& ]+') as token, COUNT(*) AS cnt
          FROM cloudfront_logs_staging_all
          WHERE
            (${where})
            AND TIMESTAMPTZ_CMP(
              CAST ((logdate || ' ' || logtime) AS timestamptz),
              GETDATE() - INTERVAL '1 hours'
            ) = 1
            AND TIMESTAMPTZ_CMP(
              CAST ((logdate || ' ' || logtime) AS timestamptz),
              GETDATE()
            ) = -1
          GROUP BY token
        ) UNION (
          SELECT REGEXP_SUBSTR(cs_uri_query, '(pk|sk)\.[^& ]+') as token, COUNT(*) AS cnt
          FROM public.cloudfront_logs_all
          WHERE
            (${where})
          GROUP BY token
        )
      )
    ORDER BY cnt DESC
  `);
};

const runQuery = (outputFolder, uri, query) => {
  const spinner = utils.spinner('Querying CloudFront logs');
  return utils.askPostgres(uri, query)
    .then((rows) => {
      spinner.stop(true);
      return utils.writeFile(path.join(outputFolder, 'hot-tokens-output.txt'), rows)
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

module.exports = (outputFolder, uri, edges) => runQuery(outputFolder, uri, query(edges));
