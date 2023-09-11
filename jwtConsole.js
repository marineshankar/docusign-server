import docusign from "docusign-esign";
import { sendEnvelope } from "./signingViaEmail.js";
import fs from "fs";
import path from "path";
import jwtConfig from "./jwtConfig.json" assert { type: "json" };
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const demoDocsPath = path.resolve(__dirname, "./");
const doc3File = "exhibit-b-client-terms.pdf";
const SCOPES = ["signature", "impersonation"];

function getConsent() {
  var urlScopes = SCOPES.join("+");

  // Construct consent URL
  var redirectUri = "https://developers.docusign.com/platform/auth/consent";
  var consentUrl =
    `${jwtConfig.dsOauthServer}/oauth/auth?response_type=code&` +
    `scope=${urlScopes}&client_id=${jwtConfig.dsJWTClientId}&` +
    `redirect_uri=${redirectUri}`;

  console.log("Open the following URL in your browser to grant consent:");
  console.log(consentUrl);
  console.log("Consent granted? \n 1)Yes \n 2)No");

  let consentGranted = prompt("");
  if (consentGranted == "1") {
    return true;
  } else {
    console.error("Please grant consent!");
    process.exit();
  }
}

async function authenticate() {
  const jwtLifeSec = 10 * 60, // requested lifetime for the JWT is 10 min
    dsApi = new docusign.ApiClient();
  dsApi.setOAuthBasePath(jwtConfig.dsOauthServer.replace("https://", "")); // it should be domain only.
  let rsaKey = fs.readFileSync(jwtConfig.privateKeyLocation);

  try {
    const results = await dsApi.requestJWTUserToken(
      jwtConfig.dsJWTClientId,
      jwtConfig.impersonatedUserGuid,
      SCOPES,
      rsaKey,
      jwtLifeSec
    );
    const accessToken = results.body.access_token;

    // get user info
    const userInfoResults = await dsApi.getUserInfo(accessToken);

    // use the default account
    let userInfo = userInfoResults.accounts.find(
      (account) => account.isDefault === "true"
    );

    return {
      accessToken: results.body.access_token,
      apiAccountId: userInfo.accountId,
      basePath: `${userInfo.baseUri}/restapi`,
    };
  } catch (e) {
    let body = e.response && e.response.body;
    // Determine the source of the error
    if (body) {
      // The user needs to grant consent
      if (body.error && body.error === "consent_required") {
        if (getConsent()) {
          return authenticate();
        }
      } else {
        // Consent has been granted. Show status code for DocuSign API error
        this._debug_log(`\nAPI problem: Status code ${
          e.response.status
        }, message body:
        ${JSON.stringify(body, null, 4)}\n\n`);
      }
    }
  }
}

function getArgs(apiAccountId, accessToken, basePath) {

  const envelopeArgs = {
    signerEmail: "marineshankar@gmail.com",
    signerName: "Shankar",
    ccEmail: "networkingshankar@gmail.com",
    ccName: "NetworkingShankar",
    status: "sent",
    doc3File: path.resolve(demoDocsPath, doc3File),
  };

  const args = {
    accessToken: accessToken,
    basePath: basePath,
    accountId: apiAccountId,
    envelopeArgs: envelopeArgs,
  };

  return args;
}

async function main() {
  let accountInfo = await authenticate();
  let args = getArgs(
    accountInfo.apiAccountId,
    accountInfo.accessToken,
    accountInfo.basePath
  );
  let envelopeId = sendEnvelope(args);
  console.log(envelopeId);
}

main();
