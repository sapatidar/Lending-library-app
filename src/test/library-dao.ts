//will run the project DAO using an in-memory mongodb server
import { MemDao, makeMemDao } from './mem-dao.js';

import { LibraryDao, } from '../lib/library-dao.js';

import * as Lib from '../lib/library.js';

import { BOOKS, } from './test-data.js';

import { assert, expect } from 'chai';

describe('library DAO', () => {

  //mocha will run beforeEach() before each test to set up these variables
  let memDao : MemDao;
  let dao: LibraryDao;
  
  beforeEach(async function () {
    const daoResult = await makeMemDao();
    assert(daoResult.isOk === true);
    memDao = daoResult.val;
    dao = memDao.dao;
  });

  //mocha runs this after each test; we use this to clean up the DAO.
  afterEach(async function () {
    await memDao.tearDown();
  });

  //TODO: add test suites here as needed to test your DAO as you implement it
  //(your DAO is available as variable "dao").

});


const PATRONS = [ 'joe', 'bill', 'sue', 'anne', 'karen' ];
const ISBNS = BOOKS.slice(0, 5).map(b => b.isbn);
//LENDS = ISBNS x PATRONS
const LENDS = ISBNS.reduce((acc, isbn) => 
  acc.concat(PATRONS.map(patronId => ({ isbn, patronId }))), []);

