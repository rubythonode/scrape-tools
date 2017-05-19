'use strict';

const findTokens = require('./lib/find-tokens-in-sumo');
const lookupUsers = require('./lib/tokens-to-users');
const prompt = require('./lib/which-users-prompt');
const query = require('./lib/query-for-ips');
const lookupOrgs = require('./lib/lookup-ip-owners');
const utils = require('./lib/utils');

/**
 * 1. Query sumo for over-active starter accounts
 * 2. Lookup each over-active token in api-core
 * 3. Prompt the caller to select the tokens they want to query
 * 4. Query CloudFront logs in Redshift for those tokens
 * 5. Lookup the organization names of owners of these IP addresses
 *
 * @param {object} options - configuration
 * @param {string} options.outputFolder - path to write suspicious tokens
 * @param {array} [options.regions] - regions to search for over-zealous starter
 * accounts. Defaults to ['ap-southeast-1', 'ap-northeast-1']
 */
module.exports = (options) => {
  let tokenCounts;

  return utils.createFolder(options.outputFolder)
    .then(() => {
      if (options.tokensFile) return findTokens.readOutputFile(options.tokensFile);
      else return findTokens(options);
    })

    .then((tokens) => {
      tokenCounts = tokens.reduce((tokenCounts, tk) => {
        tokenCounts[tk.token] = tk.count;
        return tokenCounts;
      }, {});

      return lookupUsers(options.outputFolder, tokens.map((tk) => tk.token));
    })

    .then((users) => {
      users = users.map((user) => {
        user.count = tokenCounts[user.token];
        return user;
      });

      const cloned = JSON.parse(JSON.stringify(users));

      return prompt(cloned);
    })

    .then((data) => {
      // @TODO: lookup the MetricsWarehouseUrl parameter from slack-commands-production
      const uri = 'postgresql://xxx/warehouse';
      return query(options.outputFolder, uri, data.map((tk) => tk.token));
    })

    .then((data) => {
      return lookupOrgs(Object.keys(data));
    });
};
