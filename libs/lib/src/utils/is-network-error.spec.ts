import { isNetworkError } from './is-network-error';

describe('isNetworkError', () => {
  it('должен вернуть true для ECONNREFUSED', () => {
    const error = new Error('connect ECONNREFUSED 127.0.0.1:5672');
    expect(isNetworkError(error)).toBe(true);
  });

  it('должен вернуть true для ECONNRESET', () => {
    const error = new Error('read ECONNRESET');
    expect(isNetworkError(error)).toBe(true);
  });

  it('должен вернуть true для ETIMEDOUT', () => {
    const error = new Error('connect ETIMEDOUT');
    expect(isNetworkError(error)).toBe(true);
  });

  it('должен вернуть true для socket hang up', () => {
    const error = new Error('socket hang up');
    expect(isNetworkError(error)).toBe(true);
  });

  it('должен вернуть true для ENOTFOUND', () => {
    const error = new Error('getaddrinfo ENOTFOUND example.com');
    expect(isNetworkError(error)).toBe(true);
  });

  it('должен вернуть false для обычной ошибки', () => {
    const error = new Error('Something went wrong');
    expect(isNetworkError(error)).toBe(false);
  });

  it('должен вернуть false для не-Error объекта', () => {
    const error = { message: 'ECONNREFUSED' };
    expect(isNetworkError(error)).toBe(false);
  });

  it('должен вернуть false для null', () => {
    expect(isNetworkError(null)).toBe(false);
  });

  it('должен вернуть false для undefined', () => {
    expect(isNetworkError(undefined)).toBe(false);
  });
});
