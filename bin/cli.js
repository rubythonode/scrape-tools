#!/usr/bin/env node

'use strict';

const meow = require('meow');
const search = require('..');

const cli = meow(`
  USAGE: something not ready yet
`, {
  alias: {
    t: 'tokens-file',
    f: 'output-folder'
  }
});

search(cli.flags)
  .then((data) => console.log(data))
  .catch((err) => console.error(err.stack));
