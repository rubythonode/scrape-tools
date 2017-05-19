'use strict';

const inquirer = require('inquirer');

const pad = (str, len) => {
  return (str + new Array(len).fill(' ').join('')).slice(0, len);
};

const prompt = (data, result) => {
  if (!result) result = [];
  const item = data.shift();
  if (!item) return result;

  return inquirer.prompt([
    {
      type: 'list',
      name: 'continue',
      message: `${pad(item.id, 20)}\t${pad(item.accountLevel + ' account', 20)}\t${item.count} requests. Include this user?`,
      choices: [
        'Include and continue',
        'Do not include and continue',
        'Include and do not continue',
        'Do not include and do not continue'
      ],
      default: 'Include and continue'
    }
  ]).then((answers) => {
    if (answers.continue === 'Include and continue' ||
        answers.continue === 'Include and do not continue') result.push(item);

    if (answers.continue === 'Include and do not continue' ||
        answers.continue === 'Do not include and do not continue') return result;

    return prompt(data, result);
  });
};

module.exports = prompt;
