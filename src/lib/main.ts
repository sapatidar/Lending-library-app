import assert from 'assert';
import Path from 'path';
import readline from 'readline';

import { readJson } from 'cs544-node-utils';
import { Errors } from 'cs544-js-utils';

import {LendingLibrary, makeLendingLibrary} from './lending-library.js';
import {makeLibraryDao } from './library-dao.js';

/*************************** Top-Level Code ****************************/

export default async function main(args: string[]) {
  if (args.length < 2) {
    help();
    process.exit(1);
  }
  await go(args[0], args[1], makeReq(args.slice(2)));
}

async function go(mongoUrl: string, cmd: string, req: Record<string, any>) {
  const daoResult = await makeLibraryDao(mongoUrl);
  if (!daoResult.isOk) panic(daoResult);
  const dao = daoResult.val;
  try {
    const library = makeLendingLibrary(dao);
    switch (cmd) {
      case 'addBook':
	out(await library.addBook(req));
	break;
      case 'checkoutBook':
	out(await library.checkoutBook(req));
	break;
      case 'clear':
	out(await library.clear());
	break;
      case 'findBooks':
	out(await library.findBooks(req));
	break;
      case 'loadPaths':
	out(await load(library, req));
	break;
      case 'returnBook':
	out(await library.returnBook(req));
	break;
      default:
	help();
    }
  }
  finally {
    await dao.close();
  }
}

async function load(library: LendingLibrary, req: Record<string, string>)
  : Promise<Errors.Result<void>>
{
  for (const path of Object.values(req)) {
    const readResult = await readJson(path);
    if (!readResult.isOk) return readResult;
    const books = readResult.val;
    for (const book of books) {
      const addResult = await library.addBook(book);
      if (!addResult.isOk) return addResult as Errors.Result<void>;
    }
  }
  return Errors.VOID_RESULT;
}


function help() {
  const msg = `
    usage: ${Path.basename(process.argv[1])} MONGO_URL CMD KEY=VALUE...
    for CMD in addBook|clear|checkoutBook|findBooks|loadPaths|returnBook
`.trim();
  console.log(msg);
}



/******************************* Utilities *****************************/

function out<T>(result: Errors.Result<T>) {
  if (!result.isOk) {
    errors(result);
  }
  else {
    if (result.val !== undefined) console.log(result.val);
  }
}

function makeReq(args: string[]) {
  const req: Record<string, any> = {};
  for (const arg of args) {
    let m = arg.match(/^(\w+)\=(.*)$/);
    if (!m) {
      panic(Errors.errResult(`arg ${arg} not of form "key=value"`, 'BAD_ARG'));
    }
    const [key, value] = [m[1], m[2]];
    if (/^\d+$/.test(value)) { //brittle assumption
      req[key] = Number(value);
    }
    else if (m = value.match(/^\[(.+)\]$/)) {
      req[key] = m[1].split(/\s*,\s*/);
    }
    else {
      req[key] = value;
    }
  }
  return req;
}

function errors<T>(result: Errors.Result<T>) {
  if (result.isOk === true) return;
  for (const err of result.errors) {
    let msg = `${err.options.code}: ${err.message}`;
    let opts = '';
    for (const [k, v] of Object.entries(err.options)) {
      if (k === 'code') continue;
      opts += `${k}=${v}`;
    }
    if (opts.length > 0) msg += '; ' + opts;
    console.error(msg);
  }
}

function panic<T>(result: Errors.Result<T>) : never {
  errors(result);
  process.exit(1);
}



