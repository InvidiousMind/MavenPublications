import {createRemoteJWKSet,jwtVerify} from 'jose';
export const GOOGLE_CLIENT_ID='324699535142-0gdi7883ooq4cjtke6ob2f80d6798arb.apps.googleusercontent.com';
const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'),{timeoutDuration:5000,cooldownDuration:30000,cacheMaxAge:3600000});
export async function verifyGoogleCredential(credential,nonce){
 const {payload}=await jwtVerify(credential,googleKeys,{algorithms:['RS256'],issuer:['https://accounts.google.com','accounts.google.com'],audience:GOOGLE_CLIENT_ID,requiredClaims:['sub','exp','iat','nonce'],maxTokenAge:'10m',clockTolerance:5});
 if(payload.nonce!==nonce||typeof payload.sub!=='string'||payload.sub.length>255||!payload.sub||payload.email_verified!==true||typeof payload.email!=='string'||payload.email.length>320)throw Error('Invalid Google identity');
 return {subject:payload.sub,email:payload.email};
}
