import crypto from 'crypto';

export function createNaverSignature(timestamp, method, uri, secretKey) {
  const message = `${timestamp}.${method}.${uri}`;

  return crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('base64');
}
