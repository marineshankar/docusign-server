import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import pkg from "docusign-esign";
const {
  ApiClient,
  EnvelopesApi,
  SignHere,
  Document,
  EnvelopeDefinition,
  Signer,
  CarbonCopy,
  Tabs,
  Recipients,
} = pkg;

const jwtConfig = {
  "dsJWTClientId": "2c85fe53-6708-42b3-b916-b8e4f1862855",
  "impersonatedUserGuid": "cd538e3a-54c5-472d-a4a6-7e955ea6d7ab",
  "privateKeyLocation":  "./private.key",
  "dsOauthServer": "https://account-d.docusign.com"
};

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
    dsApi = new ApiClient();
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

export const sendEnvelope = async (args) => {
  let dsApiClient = new ApiClient();
  dsApiClient.setBasePath(args.basePath);
  dsApiClient.addDefaultHeader("Authorization", "Bearer " + args.accessToken);
  let envelopesApi = new EnvelopesApi(dsApiClient);
  let results = null;

  let envelope = makeEnvelope(args.envelopeArgs);

  results = await envelopesApi.createEnvelope(args.accountId, {
    envelopeDefinition: envelope,
  });
  let envelopeId = results.envelopeId;

  console.log(`Envelope was created. EnvelopeId ${envelopeId}`);
  return { envelopeId: envelopeId };
};

function makeEnvelope(args) {
  let doc3PdfBytes;

  doc3PdfBytes = fs.readFileSync(args.doc3File);

  let env = new EnvelopeDefinition();
  env.emailSubject = "Exhibit B Terms & Conditions - Document by Worktual";

  let doc = new Document.constructFromObject({
    documentBase64: Buffer.from(doc3PdfBytes).toString("base64"),
    name: "Exhibit B Terms & Conditions",
    fileExtension: "pdf",
    documentId: "1",
  });

  env.documents = [doc];

  let signer1 = Signer.constructFromObject({
    email: args.signerEmail,
    name: args.signerName,
    recipientId: "1",
    routingOrder: "1",
  });

  let cc1 = new CarbonCopy();
  cc1.email = args.ccEmail;
  cc1.name = args.ccName;
  cc1.routingOrder = "2";
  cc1.recipientId = "2";

  let signHere1 = SignHere.constructFromObject({
    anchorString: "Signature:",
    anchorYOffset: "5",
    anchorUnits: "pixels",
    anchorXOffset: "20",
  });

  let signer1Tabs = Tabs.constructFromObject({
    signHereTabs: [signHere1],
  });
  signer1.tabs = signer1Tabs;

  let recipients = Recipients.constructFromObject({
    signers: [signer1],
    carbonCopies: [cc1],
  });
  env.recipients = recipients;

  env.status = args.status;

  return env;
}

async function main() {
  let accountInfo = await authenticate();

  const envelopeArgs = {
    signerEmail: "marineshankar@gmail.com",
    signerName: "Shankar",
    ccEmail: "networkingshankar@gmail.com",
    ccName: "NetworkingShankar",
    status: "sent",
    doc3File: path.resolve(demoDocsPath, doc3File),
  };

  const args = {
    accessToken: accountInfo.accessToken,
    basePath: accountInfo.basePath,
    accountId: accountInfo.apiAccountId,
    envelopeArgs: envelopeArgs,
  };

  let envelopeId = sendEnvelope(args);
}

main();
