import { Errors } from 'cs544-js-utils';

import { z } from 'zod';

type ZodResult<T> =
  { success: true, data: T } | { success: false, error: z.ZodError };

type Message = string;
type ErrInfo = { message: Message, options?: Record<string, string> };
type IssueFn = (issue: z.ZodIssue) => Message | ErrInfo;
type IssueInfos = Record<string, Message | ErrInfo | IssueFn>;

/** Convert a zodResult to an Errors.Result.  Use issuesInfos[zodMsg]
 *  as the translation of zodMsg.  All missing field errors will 
 *  get code `MISSING` and all bad type errors will get code `BAD_TYPE`.
 */
export function zodToResult<T>(zod: ZodResult<T>, issueInfos: IssueInfos = {}) 
  : Errors.Result<T>
{
  if (zod.success === true) {
    return Errors.okResult(zod.data);
  }
  else {
    return zodErrorToResultError(zod.error, issueInfos);
  }
}


function zodErrorToResultError<T>(zodError: z.ZodError, issueInfos: IssueInfos)
  : Errors.Result<T>
{
  const errors: Errors.Err[] = [];
  for (const zIssue of zodError.issues) {
    let err: Errors.Err;
    const msg = zIssue.message;
    let issueInfo = issueInfos[msg];
    if (typeof issueInfo === 'function') {
      issueInfo = issueInfo(zIssue);
    }
    const message =
      (typeof issueInfo === 'object')
      ? issueInfo.message
      : (typeof issueInfo === 'string') 
      ? issueInfo
      : issueMessage(zIssue);
    const options = (typeof issueInfo === 'object')
      ? issueOptions(zIssue, issueInfo.options)
      : issueOptions(zIssue);
    err = new Errors.Err(message, options);
    errors.push(err);
  }
  return new Errors.ErrResult(errors);
}


function issueMessage(zIssue: z.ZodIssue) {
  let message = zIssue.message;
  const path = zIssue.path ?? [];
  const widget = (path.at(-1) ?? '').toString();
  if (zIssue.code === z.ZodIssueCode.invalid_type) {
    if (zIssue.received === 'undefined') {
      message = `${widget} is required`.trim();
    }
    else {
      message = `${widget} must have type ${zIssue.expected}`.trim();
    }
  }
  return message;
}

function issueOptions(zIssue: z.ZodIssue, options: Record<string, string>={}) {
  const path = zIssue.path ?? [];
  const widget = (path.at(-1) ?? '').toString();
  let code = 'BAD_REQ';
  if (zIssue.code ===  z.ZodIssueCode.invalid_type) {
    if (zIssue.received === 'undefined') {
      code = 'MISSING';
    }
    else {
      code = 'BAD_TYPE';
    }
  }
  return { code, ...options, path: path.join('|'), };
}
