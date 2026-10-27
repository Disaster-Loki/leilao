// SSL só quando a URL pede (Neon traz ?sslmode=require). Local e Docker: sem SSL.
export const sslFor = (url: string) =>
  /sslmode=(require|verify-full|verify-ca)/.test(url) ? { rejectUnauthorized: false } : false;