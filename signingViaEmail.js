import fs from "fs-extra";
import pkg from 'docusign-esign';
const { ApiClient, EnvelopesApi, SignHere, Document, EnvelopeDefinition, Signer, CarbonCopy, Tabs, Recipients } = pkg;


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
