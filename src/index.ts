#!/usr/bin/env node

import main from './lib/main.js';

main(process.argv.slice(2)).catch(err => console.error(err));
