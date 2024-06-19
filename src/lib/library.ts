import { Errors } from 'cs544-js-utils';
import { zodToResult } from './zod-utils.js';
import { z } from 'zod';

const GUTENBERG_YEAR = 1448;
const NOW_YEAR = new Date().getFullYear();

//specify key in zod validator to get value as message after
//passing through zodToResult()
const MSGS = {
  'msg.isbn':  'isbn must be of the form "ddd-ddd-ddd-d"',
  'msg.nonEmpty': 'must be non-empty',
  'msg.oneOrMoreAuthors': 'must have one or more authors',
  'msg.publishYear': `must be a past year on or after ${GUTENBERG_YEAR}`,
};

// use zod to force Book to have the following fields:
//   isbn: a ISBN-10 string of the form ddd-ddd-ddd-d.
//   title: a non-empty string.
//   authors: a non-empty array of non-empty strings.
//   pages: a positive integer.
//   year: an integer within the range [GUTENBERG_YEAR, NOW_YEAR].
//   publisher: a non-empty string.
//   nCopies: an optional positive integer
const Book =  z.object({
  isbn: z.string().length(13).regex(/^\d{3}-\d{3}-\d{3}-\d{1}$/),
  title: z.string().refine((str)=>str.trim().length>0),
  authors: z.string().min(1).array().min(1),
  pages: z.number().positive().int(),
  year: z.number().int().gte(GUTENBERG_YEAR).lte(NOW_YEAR),
  publisher: z.string().refine((str)=>str.trim().length>0),
  nCopies: z.number().positive().int().optional(),
});

export type Book = z.infer<typeof Book>;

const XBook = Book.required();
export type XBook = z.infer<typeof XBook>;

// use zod to force Find to have the following fields:
//   search: a string which contains at least one word of two-or-more \w.
//   index: an optional non-negative integer.
//   count: an optional non-negative integer.
const Find = z.object({
  search: z.string().refine((str)=>{
    const result = str.match(/\w{2,}/g);
    if(result === null)
    return false;
    return (result as string[]).length > 0;
  }),
  index: z.number().int().gte(0).optional(),
  count: z.number().int().gte(0).optional(),
});
export type Find = z.infer<typeof Find>;

// use zod to force Lend to have the following fields:
//   isbn: a ISBN-10 string of the form ddd-ddd-ddd-d.
//   patronId: a non-empty string.
const Lend = z.object({
  isbn: z.string().length(13).regex(/^\d{3}-\d{3}-\d{3}-\d{1}$/),
  patronId: z.string().refine((str)=>str.trim().length>0),
});
export type Lend = z.infer<typeof Lend>;

const VALIDATORS: Record<string, z.ZodSchema> = {
  addBook: Book,
  findBooks: Find,
  checkoutBook: Lend,
  returnBook: Lend,
};



export function validate<T>(command: string, req: Record<string, any>)
  : Errors.Result<T> 
{ const validator = VALIDATORS[command];

  const res = zodToResult(validator.safeParse(req), MSGS);
  /*
  if(res.isOk === false){
    res.errors.forEach((e)=>{
      let path: string;
      if('path' in e.options){path = e.options.path;}

    });
  }*/
  return (validator)
    ? zodToResult(validator.safeParse(req), MSGS)
    : Errors.errResult(`no validator for command ${command}`);
}
