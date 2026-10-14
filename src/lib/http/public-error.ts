import { APIError } from 'payload'

/**
 * A 400 whose message reaches the client. In the minified prod bundle the class name is empty and `instanceof`
 * fails across chunks, so Payload's formatErrors would answer "An unknown error occurred." — hence the explicit name.
 */
export const publicError = (message: string, field: string) =>
  Object.assign(new APIError(message, 400, { field }, true), { name: 'APIError' })
