import { makeLibraryDao, LibraryDao, } from '../lib/library-dao.js';

import { Errors } from 'cs544-js-utils';

import * as mongo from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { assert } from 'chai';

export async function makeMemDao() : Promise<Errors.Result<MemDao>> {
  const server = await MongoMemoryServer.create();
  assert(server.instanceInfo, `mongo memory server startup failed`);
  const uri = server.getUri();
  const daoResult = await makeLibraryDao(uri);
  if (!daoResult.isOk) return daoResult as Errors.Result<MemDao>;
  const dao = daoResult.val;
  return Errors.okResult(new MemDao(server, dao));
}

export class MemDao  {

  private readonly server: MongoMemoryServer;
  readonly dao: LibraryDao;
  
  constructor(server: MongoMemoryServer, dao: LibraryDao) {
    this.server = server;
    this.dao = dao;
  }

  async tearDown() {
    await this.dao.close();
    await this.server.stop();
    assert.equal(this.server.instanceInfo, undefined,
		 `mongo memory server stop failed`);
  }

}
