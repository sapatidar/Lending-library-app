//will run the project DAO using an in-memory mongodb server
import { LendingLibrary, makeLendingLibrary } from '../lib/lending-library.js';
import { MemDao, makeMemDao } from './mem-dao.js';

import { LibraryDao, } from '../lib/library-dao.js';

import * as Lib from '../lib/library.js';

import { BOOKS, } from './test-data.js';

import { assert, expect } from 'chai';


//use assert(result.isOk === true) and assert(result.isOk === false)
//to ensure that typescript narrows result correctly


describe('lending library', () => {

  let memDao : MemDao;
  let library: LendingLibrary;
  
  beforeEach(async function () {
    const daoResult = await makeMemDao();
    assert(daoResult.isOk === true);
    memDao = daoResult.val;
    library = makeLendingLibrary(memDao.dao);
  });

  //mocha runs this after each test; we use this to clean up the DAO.
  afterEach(async function () {
    await memDao.tearDown();
  });


  describe('addBook()', () => {

    const NUMERIC_FIELDS = [ 'pages', 'year', 'nCopies' ];

    it('must add valid book', async () => {
      for (const book of BOOKS) {
	const bookResult = await library.addBook(book);
	assert(bookResult.isOk === true);
	expect(bookResult.val.nCopies).to.equal((book.nCopies ?? 1));
      }
    });

    it('must catch missing required fields', async () => {
      const book = BOOKS[0];
      for (const key of Object.keys(book)) {
	if (key === 'nCopies') continue;
	const book1: Record<string, any> = { ...book };
	delete book1[key];
	const bookResult = await library.addBook(book1);
	assert(bookResult.isOk === false);
	expect(bookResult.errors.length).to.be.gt(0);
      }
    });

    it('must catch badly typed numeric fields', async () => {
      const book = BOOKS[0];
      for (const key of NUMERIC_FIELDS) {
	const book1: Record<string, any> = { ...book };
	book1[key] = 'hello';
	const bookResult = await library.addBook(book1);
	assert(bookResult.isOk === false);
	expect(bookResult.errors.length).to.be.gt(0);
      }
    });

    it('must catch nCopies field <= 0', async () => {
      for (const [i, book] of BOOKS.entries()) {
	const book1 = { ...book, nCopies: -i };
	const bookResult = await library.addBook(book1);
	assert(bookResult.isOk === false);
	expect(bookResult.errors.length).to.be.gt(0);
      }
    });

    it('must catch non-integer nCopies field', async () => {
      for (const book of BOOKS) {
	const book1 = { ...book, nCopies: 2.001 };
	const bookResult = await library.addBook(book1);
	assert(bookResult.isOk === false);
	expect(bookResult.errors.length).to.be.gt(0);
      }
    });

    it('must catch badly typed string fields', async () => {
      const book = BOOKS[0];
      for (const key of Object.keys(book)) {
	if (NUMERIC_FIELDS.includes(key) || key === 'authors') continue;
	const book1: Record<string, any> = { ...book };
	book1[key] = 11;
	const bookResult = await library.addBook(book1);
	assert(bookResult.isOk === false);
	expect(bookResult.errors.length).to.be.gt(0);
      }
    });

    it('must catch badly typed authors field', async () => {
      const book = BOOKS[0];
      const book1: Record<string, any> = { ...book };
      book1.authors = 'hello';
      const bookResult = await library.addBook(book1);
      assert(bookResult.isOk === false);
      expect(bookResult.errors.length).to.be.gt(0);
    });

    it('must catch badly typed author', async () => {
      const book = BOOKS[0];
      const book1: Record<string, any> = { ...book };
      book1.authors = ['hello', 22];
      const bookResult = await library.addBook(book1);
      assert(bookResult.isOk === false);
      expect(bookResult.errors.length).to.be.gt(0);
    });

    it('must catch empty authors', async () => {
      const book = BOOKS[0];
      const book1 = { ...book };
      book1.authors = [];
      const bookResult = await library.addBook(book1);
      assert(bookResult.isOk === false);
      expect(bookResult.errors.length).to.be.gt(0);
    });

  });  //describe('addBooks()', ...)


  describe('findBooks()', async () => {

    beforeEach(async () => {
      for (const book of BOOKS) {
	const bookResult = await library.addBook(book);
	assert(bookResult.isOk === true);
      }
    });

    it('must error on an empty search string error', async () => {
      const searchResult = await library.findBooks({search: '  '});
      assert(searchResult.isOk === false);
      expect(searchResult.errors.length).to.be.gt(0);
    });
	       
    it('must error on a search string without any words error', async () => {
      const searchResult = await library.findBooks({search: 'a #b  '});
      assert(searchResult.isOk === false);
      expect(searchResult.errors.length).to.be.gt(0);
    });

    it('must error on a search field with bad index/count', async () => {
      for (const k of [ 'index', 'count' ]) {
	for (const v of [ 'xx', -1]) {
	  const req: Record<string, any> = { search: 'hello', [k]: v, };
	  const searchResult = await library.findBooks(req);
	  assert(searchResult.isOk === false);
	  expect(searchResult.errors.length).to.be.gt(0);
	}
      }
    });

    it('must find all results', async () => {
      const count = 9999;
      for (const lang of [ 'javascript', 'ruby', 'scala' ]) {
	const search = {search: `a ${lang} `, count}
	const searchResult = await library.findBooks(search);
	assert(searchResult.isOk === true);
	expect(searchResult.val).to.have.length(LANG_BOOKS[lang].length);
	const expected = LANG_BOOKS[lang].map(b => ({nCopies: 1, ...b}));
	expect(searchResult.val).to.deep.equal(expected);
      }
    });
	       
    it('must find multiple results', async () => {
      const count = 9999;
      const search = {search: 'a #definitive ', count}
      const searchResult = await library.findBooks(search);
      assert(searchResult.isOk === true);
      const expected = BOOKS
	.filter(b => b.title.match(/definitive/i))
	.sort((b1, b2) => b1.title.localeCompare(b2.title))
        .map(b => ({ nCopies: 1, ...b }));
      expect(searchResult.val).to.deep.equal(expected);
    });

    it('must find results for multi-word searches', async () => {
      const count = 9999;
      const search = {search: 'a #definitive @JAVASCRIPT', count};
      const searchResult = await library.findBooks(search);
      assert(searchResult.isOk === true);
      const expected = BOOKS
	.filter(b => b.title.match(/definitive/i))
	.filter(b => b.title.match(/javascript/i))
	.sort((b1, b2) => b1.title.localeCompare(b2.title))
        .map(b => ({ nCopies: 1, ...b }));
      expect(searchResult.val).to.deep.equal(expected);
    });

    it('must find a subsequence of JavaScript books', async () => {
      const js = 'javascript';
      const [index, count] = [2, 4];
      const result = await library.findBooks({search: js, count, index});
      assert(result.isOk === true);
      const foundBooks = result.val;
      const jsBooks = BOOKS.filter(b => b.title.toLowerCase().indexOf(js) >= 0)
	.sort((b1, b2) => b1.title.localeCompare(b2.title))
	.slice(index, index + count);
      expect(foundBooks.length).to.be.lte(count);
      expect(foundBooks).to.deep.equal(jsBooks);
    });

    it('must find no results', async () => {
      const searchResult =
	await library.findBooks({ search: 'a #definitive1 '});
      assert(searchResult.isOk === true);
      expect(searchResult.val).to.have.length(0);
    });

    
  });

  describe('checkoutBook() with empty library', async () => {

    it('must error on missing field', async () => {
      for (const f of [ 'isbn', 'patronId' ]) {
	const v = (f === 'isnb') ? BOOKS[0].isbn : PATRONS[0];
	const req = { [f]: v };
	const checkoutResult = await library.checkoutBook(req);
	assert(checkoutResult.isOk === false);
	expect(checkoutResult.errors.length).to.be.gt(0);
      }
    });


    it('must error on bad book', async () => {
      const [ patronId, isbn ] = [ PATRONS[0], BOOKS[0].isbn ];
      const checkoutResult = await library.checkoutBook({ patronId, isbn });
      assert(checkoutResult.isOk === false);
      expect(checkoutResult.errors.length).to.be.gt(0);
    });

  });    

  describe('checkoutBook() with populated library', async () => {
    
    beforeEach(async () => {
      for (const book of BOOKS) {
	const bookResult = await library.addBook(book);
	assert(bookResult.isOk === true);
      }
    });

    it('must allow checkout of multiple books by same patron', async () => {
      for (const book of BOOKS) {
	const [ patronId, isbn ] = [ PATRONS[0], book.isbn ];
	const checkoutResult = await library.checkoutBook({patronId, isbn});
	assert(checkoutResult.isOk === true);
      }
    });

    it('must error on repeated checkout of same book by same patron', async () => {
      const [ patronId, isbn ] = [ PATRONS[0], BOOK_nCopies2.isbn ];
      const checkoutResult1 = await library.checkoutBook({patronId, isbn});
      assert(checkoutResult1.isOk === true);
      const checkoutResult2 = await library.checkoutBook({ patronId, isbn });
      assert(checkoutResult2.isOk === false);
      expect(checkoutResult2.errors.length).to.be.gt(0);
    });

    it('must error on exhausting all copies of a book', async () => {
      const isbn = BOOK_nCopies2.isbn;
      for (const [i, patronId] of PATRONS.entries()) {
	const checkoutResult1 = await library.checkoutBook({patronId, isbn});
	assert(checkoutResult1.isOk === i < 2, `copy ${i} checkout ${i < 2}`);
      }
    });

  });

  describe('returnBook() with empty library', async () => {

    it('must error on missing field', async () => {
      for (const f of [ 'isbn', 'patronId' ]) {
	const v = (f === 'isnb') ? BOOKS[0].isbn : PATRONS[0];
	const req = { [f]: v };
	const checkoutResult = await library.returnBook(req);
	assert(checkoutResult.isOk === false);
	expect(checkoutResult.errors.length).to.be.gt(0);
      }
    });

    it('must error on bad book', async () => {
      const [ patronId, isbn ] = [ PATRONS[0], BOOKS[0].isbn ];
      const checkoutResult = await library.returnBook({ patronId, isbn });
      assert(checkoutResult.isOk === false);
      expect(checkoutResult.errors.length).to.be.gt(0);
    });
  });

  describe('checkout and return books', async () => {

    beforeEach(async () => {
      for (const book of BOOKS) {
	const bookResult = await library.addBook(book);
	assert(bookResult.isOk === true);
      }
    });

    it('must allow checkout/return of single book by same patron', async () => {
      for (const book of BOOKS) {
	const [ patronId, isbn ] = [ PATRONS[0], book.isbn ];
	const checkoutResult = await library.checkoutBook({patronId, isbn});
	assert(checkoutResult.isOk === true);
	const returnResult = await library.returnBook({patronId, isbn});
	assert(returnResult.isOk === true);
      }
    });

    it('must allow checkout/return of many books by same patron', async () => {
      for (const book of BOOKS) {
	const [ patronId, isbn ] = [ PATRONS[0], book.isbn ];
	const checkoutResult = await library.checkoutBook({patronId, isbn});
	assert(checkoutResult.isOk === true);
      }
      for (const book of BOOKS) {
	const [ patronId, isbn ] = [ PATRONS[0], book.isbn ];
	const returnResult = await library.returnBook({patronId, isbn});
	assert(returnResult.isOk === true);
      }
    });

    it('must allow any order checkout/return of books by patron', async () => {
      for (const book of BOOKS) {
	const [ patronId, isbn ] = [ PATRONS[0], book.isbn ];
	const checkoutResult = await library.checkoutBook({patronId, isbn});
	assert(checkoutResult.isOk === true);
      }
      for (const book of BOOKS.toReversed()) {
	const [ patronId, isbn ] = [ PATRONS[0], book.isbn ];
	const returnResult = await library.returnBook({patronId, isbn});
	assert(returnResult.isOk === true);
      }
    });
    
    it('must allow checkout/return of books by multiple patrons', async () => {
      for (const [i, book] of BOOKS.entries()) {
	const [ patronId, isbn ] = [ PATRONS[i%PATRONS.length], book.isbn ];
	const checkoutResult = await library.checkoutBook({patronId, isbn});
	assert(checkoutResult.isOk === true);
      }
      for (const [i, book]  of BOOKS.entries()) {
	const [ patronId, isbn ] = [ PATRONS[i%PATRONS.length], book.isbn ];
	const returnResult = await library.returnBook({patronId, isbn});
	assert(returnResult.isOk === true);
      }
    });
    
    it('must not allow return of books by different patrons', async () => {
      for (const [i, book] of BOOKS.entries()) {
	const [ patronId, isbn ] = [ PATRONS[i%PATRONS.length], book.isbn ];
	const checkoutResult = await library.checkoutBook({patronId, isbn});
	assert(checkoutResult.isOk === true);
      }
      for (const [i, book]  of BOOKS.entries()) {
	const j = (i + 1)%(PATRONS.length);
	const [ patronId, isbn ] = [ PATRONS[j], book.isbn ];
	const returnResult = await library.returnBook({patronId, isbn});
	assert(returnResult.isOk === false);
	expect(returnResult.errors.length).to.be.gt(0);
      }
    });

    it('must not allow repeated return of books by a patron', async () => {
      for (const book of BOOKS) {
	const [ patronId, isbn ] = [ PATRONS[0], book.isbn ];
	const checkoutResult = await library.checkoutBook({patronId, isbn});
	assert(checkoutResult.isOk === true);
      }
      for (const book  of BOOKS.toReversed()) {
	const [ patronId, isbn ] = [ PATRONS[0], book.isbn ];
	const returnResult1 = await library.returnBook({patronId, isbn});
	assert(returnResult1.isOk === true);
	const returnResult2 = await library.returnBook({patronId, isbn});
	assert(returnResult2.isOk === false);
	expect(returnResult2.errors.length).to.be.gt(0);
      }
    });
    
    
  });    

});

const PATRONS = [ 'joe', 'sue', 'ann' ];


function findLangBooks(books: (typeof BOOKS[0])[], lang: string) {
  return books.filter(b => b.title.toLowerCase().includes(lang))!
    .sort((b1, b2) => b1.title.localeCompare(b2.title));
}

const LANG_BOOKS: Record<string, (typeof BOOKS[0])[]> = {
  javascript: findLangBooks(BOOKS, 'javascript'),
  ruby: findLangBooks(BOOKS, 'ruby'),
  scala: findLangBooks(BOOKS, 'scala'),
}

const BOOK_nCopies1 = BOOKS.find(b => b.nCopies === 1)!;
const BOOK_nCopies2 = BOOKS.find(b => b.nCopies === 2)!;
const BOOK_nCopies3 = BOOKS.find(b => b.nCopies === 3)!;

assert(BOOK_nCopies1, 'no book with # of copies === 1');
assert(BOOK_nCopies2, 'no book with # of copies === 2');
assert(BOOK_nCopies3, 'no book with # of copies === 3');

