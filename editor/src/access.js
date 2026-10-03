import { createRemoteJWKSet, jwtVerify } from "jose";

const keySets = new Map();

export async function verifyAccess(token, config, suppliedKeys) {
  let keys = suppliedKeys || keySets.get(config.issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${config.issuer}/cdn-cgi/access/certs`));
    keySets.set(config.issuer, keys);
  }
  const { payload } = await jwtVerify(token, keys, {
    issuer: config.issuer,
    audience: config.audience,
    algorithms: ["RS256"],
    requiredClaims: ["exp", "iat", "sub", "email"]
  });
  return payload;
}
