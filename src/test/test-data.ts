import Path from 'path';

import { Errors } from 'cs544-js-utils';
import { readJson } from 'cs544-node-utils';

import { Book } from '../lib/library.js';

const BOOKS = await getTestBooks(); //yeah for top-level awaits!!


export { BOOKS, };

//bit messy, but don't want to copy data;
//also, import json requires experimental import assertions
async function getTestBooks() {
  const dataPath = Path.join(process.env.HOME, 'cs544/data/books.json');
  const readResult = await readJson(dataPath);
  if (readResult.isOk === false) throw readResult.errors;
  return readResult.val as Book[];
}
