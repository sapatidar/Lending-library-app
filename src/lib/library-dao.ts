import * as mongo from 'mongodb';

import { Errors } from 'cs544-js-utils';

import * as Lib from './library.js';
import * as Len from './lending-library.js';

//TODO: define any DB specific types if necessary
type DbBook = Lib.XBook & { _id: string };
type CheckOuts = Lib.Lend;

export async function makeLibraryDao(dbUrl: string) {
  return await LibraryDao.make(dbUrl);
}

//options for new MongoClient()
const MONGO_OPTIONS = {
  ignoreUndefined: true,  //ignore undefined fields in queries
};


export class LibraryDao {

  //called by below static make() factory function with
  //parameters to be cached in this instance.
  constructor(private readonly client: mongo.MongoClient,
    private readonly books: mongo.Collection<DbBook>,
    private readonly checkouts: mongo.Collection<CheckOuts>) {
  }

  //static factory function; should do all async operations like
  //getting a connection and creating indexing.  Finally, it
  //should use the constructor to return an instance of this class.
  //returns error code DB on database errors.
  static async make(dbUrl: string) : Promise<Errors.Result<LibraryDao>> {
    try {
      const client = await (new mongo.MongoClient(dbUrl, MONGO_OPTIONS)).connect();
      const db = client.db();
      const books = db.collection<DbBook>('XBOOKS_COLLECTION');
      const checkouts = db.collection<CheckOuts>('CHECKOUTS_COLLECTION');
      await books.createIndex({ title: 'text', authors: 'text', });
      return Errors.okResult(new LibraryDao(client, books, checkouts));
    }
    catch (error) {
      return Errors.errResult(error.message, 'DB');
    }
  }

  /** close off this DAO; implementing object is invalid after 
   *  call to close() 
   *
   *  Error Codes: 
   *    DB: a database error was encountered.
   */
  async close() : Promise<Errors.Result<void>> {
    try {
      await this.client.close();
      return Errors.VOID_RESULT;
    }
    catch (e) {
      return Errors.errResult(e.message, 'DB');
    }
  }
  
  //add methods as per your API

  async clear() : Promise<Errors.Result<void>> {
    try {
      await this.books.deleteMany({});
      await this.checkouts.deleteMany({});
      return Errors.VOID_RESULT;
    }
    catch (e) {
      return Errors.errResult(e.message, 'DB');
    }
  }

  async addBook(newBook: Lib.XBook) : Promise<Errors.Result<Lib.XBook>> {
      try {
      const newObject = {...newBook, _id: newBook.isbn};
      const oldBook= await this.books.findOne({'isbn' : newBook.isbn});
      if(oldBook){
        const comRes = Len.compareBook(oldBook, newObject)
        if(comRes===undefined){
          const res = await this.books.findOneAndUpdate({'isbn' : oldBook.isbn}, {$inc: {'nCopies' : newBook.nCopies}}, {returnDocument: mongo.ReturnDocument.AFTER});
          return Errors.okResult(res);
        }else{
          return Errors.errResult('Invalid book/data mismatch', {code:'BAD_TYPE',widget: 'isbn'});
        }
      }else{
        const res: mongo.InsertOneResult = await this.books.insertOne(newObject);
        return Errors.okResult(newBook);
      }
    }
    catch (e) {
      return Errors.errResult(e.message, 'DB');
    }
  }

  async findBooks(req: Record<string, any>) : Promise<Errors.Result<Lib.XBook[]>> {
    try {
      const projection = { _id: false};
      const cur = await this.books.find({$text: { $search: req.inputWords}}, {projection});
      const result = await cur.sort({title: 1}).skip(req.index).limit(req.count).toArray();
      return Errors.okResult(result);
    }
    catch (e) {
      return Errors.errResult(e.message, 'DB');
    }
  }

  async checkoutBook(req: CheckOuts) : Promise<Errors.Result<void>> {
    try {
      const book= await this.books.findOne({'isbn' : req.isbn});
      if(!book) return Errors.errResult('invalid isbn', {code:'BAD_TYPE',widget: 'isbn'});

      const resultArr: CheckOuts[] = await this.checkouts.find({'isbn': req.isbn}).toArray();
      if(resultArr.length === book.nCopies) return Errors.errResult('no copies available', {code:'BAD_TYPE',widget: 'isbn'});

      const count:number = resultArr.reduce((res, curr)=>{
        if(curr.patronId===req.patronId)
        return res+1;
      }, 0);
      if(count>0) return Errors.errResult('Book already checked out by patron', {code:'BAD_TYPE',widget: 'isbn'});

      const res: mongo.InsertOneResult = await this.checkouts.insertOne(req);
      return Errors.VOID_RESULT;
    }
    catch (e) {
      return Errors.errResult(e.message, 'DB');
    }
  }

  async returnBook(req: CheckOuts) : Promise<Errors.Result<void>> {
    try {
      const book= await this.books.findOne({'isbn' : req.isbn});
      if(!book) return Errors.errResult('invalid isbn',{code:'BAD_TYPE',widget: 'isbn'});

      const resultArr: CheckOuts[] = await this.checkouts.find({'isbn': req.isbn, 'patronId' : req.patronId}).toArray();
      if(resultArr.length === 0) return Errors.errResult('Book not checked out by patron',{code:'BAD_TYPE',widget: 'isbn'});

      const res = await this.checkouts.deleteOne({'isbn': req.isbn, 'patronId' : req.patronId});
      return Errors.VOID_RESULT;
    }
    catch (e) {
      return Errors.errResult(e.message, 'DB');
    }
  }

} //class LibDao


