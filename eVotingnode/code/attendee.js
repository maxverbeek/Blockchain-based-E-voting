//////////////////////////////////////////////////////////
// Attendee attend-event-app
// (c) A.J. Wischmann 2021
//////////////////////////////////////////////////////////
"use strict";
const { sendData, SingleNodeClient, Converter } = require("@iota/iota.js");

const {
  mamFetch,
  TrytesHelper,
  channelRoot,
  createChannel,
} = require("@iota/mam-chrysalis.js");
const {
  bufferToHex,
  hexToBuffer,
  sha256,
  encrypt,
  utf8ToBuffer,
} = require("eccrypto-js");
const luxon = require("luxon");
const fs = require("fs");
const prompt = require("prompt-sync")({ sigint: true });
const colors = require("colors");

const node = "https://api.hornet-0.testnet.chrysalis2.com";
const commonSideKey =
  "SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSA";

let publicEventRoot = "";
let attendancyAddress = "";
let expdatetime = "";
let eventInformation = "";

// Personal information to calculate the Merkle-root
const personalFirstName = "Jaden";
const personalSurname = "Smith";
const personalGender = "Male";
const personalBirthdate = "19980820";
const personalMail = "robertsmith@gmail.com";
const personalDID = "did:example:123456789abcdefghi#key-1";
const organisation = "International Red Cross";
// for demo-purpose
const personalMerkleRoot =
  "ec76f5e70d24137494dbade31136119b52458b19105fd7e5b5812f4de38z82q7";
let eventPersonalMerkleRoot;

function readQR() {
  // Try and load the QR-root from file - as substitute for QRscan from camera
  try {
    const data = fs.readFileSync("./json/QRcode.json", "utf8");
    return data;
  } catch (err) {}
}

async function readQRmam(qrSeed) {
  const mode = "restricted";
  const sideKey = "DATE"; //TODO make it dynamic UTC-date?
  let rootValue = "NON";
  let indexationKey = "";

  let qrRoot = channelRoot(createChannel(qrSeed, 2, mode, sideKey));
  //DEBUGINFO
  // console.log("Fetching from tangle, please wait...");
  // console.log(`Node : ${node}`.yellow);
  // console.log(`qrRoot : ${qrRoot}`.yellow);
  // console.log(`mode : ${mode}`.yellow);
  // console.log(`sideKey : ${sideKey}`.yellow);

  // Try fetching from MAM
  console.log("Fetching from tangle, please wait...");
  const fetched = await mamFetch(node, qrRoot, mode, sideKey);
  if (fetched) {
    let fMessage = JSON.parse(TrytesHelper.toAscii(fetched.message));
    // console.log("Fetched : ", fMessage);
    rootValue = fMessage.root;
    indexationKey = fMessage.indexation;
    expdatetime = fMessage.expirytimestamp;
    // console.log(`Message.root : ${rootValue}`);
    // console.log(`Message.indexation : ${indexationKey}`);
    console.log(`Expirydatetime : ${expdatetime}`);
  } else {
    console.log("Nothing was fetched from the MAM channel");
  }
  publicEventRoot = rootValue;
  attendancyAddress = indexationKey;
  //DEBUGINFO
  // console.log("MAMdata ===================".red);
  // console.log(`fetched : ${fetched.message}`.green);
  // console.log("============================".yellow);
  // console.log(publicEventRoot);
  // console.log(attendancyAddress);
}

async function readPublicEventInfo(publicEventRoot) {
  const mode = "restricted";
  const sideKey = commonSideKey;
  //DEBUGINFO
  // console.log("Fetching from publicEventtangle with this information :");
  // console.log(`Node : ${node}`.yellow);
  // console.log(`EventRoot : ${publicEventRoot}`.yellow);
  // console.log(`mode : ${mode}`.yellow);
  // console.log(`sideKey : ${sideKey}`.yellow);

  // Try fetching from MAM
  console.log("Fetching from tangle, please wait...");
  const fetched = await mamFetch(node, publicEventRoot, mode, sideKey);
  if (fetched) {
    let fMessage = JSON.parse(TrytesHelper.toAscii(fetched.message));
    // console.log("Fetched : ", fMessage);
    eventInformation = fMessage;
  } else {
    console.log("Nothing was fetched from the MAM channel");
  }
  //DEBUGINFO
  // console.log("MAMdata ===================".red);
  // console.log(`fetched : ${fetched.message}`.green);
}

function presentEventInfo(eventRecord) {
  console.log("=================================".red);
  console.log("Event :".cyan);
  console.log(`Name : ${eventRecord.eventname}`);
  console.log(`Date : ${eventRecord.eventdate}`);
  console.log(`Time : ${eventRecord.eventtime}`);
  console.log(`Location : ${eventRecord.eventloc}`);
  console.log("Organised by :".cyan);
  console.log(`Organisation : ${eventRecord.orgname}`);
  console.log(`Address : ${eventRecord.orgaddress}`);
  console.log(`Zipcode : ${eventRecord.orgzip}`);
  console.log(`City : ${eventRecord.orgcity}`);
  console.log(`Tel.nr. : ${eventRecord.orgtel}`);
  console.log(`E-mail : ${eventRecord.orgmail}`);
  console.log(`WWW : ${eventRecord.orgurl}`);
  console.log(`DID : ${eventRecord.orgdid}`);
  console.log("=================================".red);
}

function saveInfoToWallet() {
  // write information about the event to Wallet
  // include the peronal information also because
  // this could change over time.

  // mr should be constructed from personalInfo
  // included just for demo-purposes
  const payload = {
    firstname: personalFirstName,
    lastname: personalSurname,
    gender: personalGender,
    birthdate: personalBirthdate,
    mail: personalMail,
    organisation: organisation,
    did: personalDID,
    mr: personalMerkleRoot,
    er: publicEventRoot,
  };

  // Store personal eventinformation in Wallet
  // to be used for generating a new verifierQR anytime
  console.log("Save data to wallet >>>>>>>>".green);
  try {
    fs.writeFileSync(
      "./json/personalWallet.json",
      JSON.stringify(payload, undefined, "\t")
    );
  } catch (e) {
    console.error(e);
  }
}

async function hashHash(mroot) {
  let element = await sha256(utf8ToBuffer(mroot));
  return bufferToHex(element);
}

async function mamInteract(eventQR,personalGender) {
  // start the whole process

  await readQRmam(eventQR);
  if (publicEventRoot === "NON") {
    console.log("Invalid eventRoot-address".brightred);
    return;
  }
  let nowDate = luxon.DateTime.now();
  let expFromISO = luxon.DateTime.fromISO(expdatetime);
  // console.log(nowDate.toISO());
  // console.log(expFromISO.toISO());
  // if (nowDate.toMillis() > expFromISO.toMillis()) {
  if (nowDate > expFromISO) {
    // check for expiry of registration - set by organiser: 20? min
    console.log("The event has expired.".brightRed);
    return;
  }
  
  // claim varefication can be done here before storing it into wallet
  if(personalGender=="Male"){
    console.log("Claim verification success".green);
  }else{
    console.log("Claim verification failed".red);
    return;
  }

  await readPublicEventInfo(publicEventRoot);
  presentEventInfo(eventInformation);

  const answer = prompt(
    "Would you like to register for this event and vote? [Y,n]: ".yellow
  );
  if (answer == "n") {
    return;
  }

  const payloadRemark = prompt(`Optional remark : `.cyan);

  //TODO hashPersonalInfo
  // setup&calculate merkle-root

  // include publicEventRoot to make this token unique per event
  eventPersonalMerkleRoot = personalMerkleRoot + publicEventRoot;
  const mh2 = await hashHash(eventPersonalMerkleRoot);
  const merkleHash2 = await hashHash(mh2);
  //DEBUGINFO
  // console.log("eventPersonalMerkleRoot :".red);
  // console.log(eventPersonalMerkleRoot);
  // console.log(merkleHash2);
  // console.log("===========");

  const payload0 = {
    attendeeID: merkleHash2,
    remark: payloadRemark, //HINT optional, can remain empty. Will be striped by closeevent.
    timestamp: new Date().toLocaleString(),
  };

  //DEBUGINFO
  // console.log("Payloadcontent ==============".green);
  // console.log(payload0);

  // writeAttendancy2Tangle
  console.log("Writing attendancy to Tangle ... ========".yellow);
  const client = new SingleNodeClient(node);
  const myIndex = attendancyAddress;

  // encrypt attendeeData with eventPublicKey
  const attendeeData = JSON.stringify(payload0);
  const pubKey = hexToBuffer(eventInformation.eventPublicKey);
  const encrypted2 = await encrypt(pubKey, attendeeData);
  
  const payloadEnc = {
    a: bufferToHex(encrypted2.iv),
    b: bufferToHex(encrypted2.ephemPublicKey),
    c: bufferToHex(encrypted2.ciphertext),
    d: bufferToHex(encrypted2.mac),
    e: "ho",
  };
  //DEBUGINFO
  // console.log("enc2");
  const encrypted = JSON.stringify(payloadEnc);
  // console.log(encrypted);

  console.log(`PublicKey : ${eventInformation.eventPublicKey}`.green);
  // const encrypted = attendeeData;

  const sendResult = await sendData(
    client,
    myIndex,
    Converter.utf8ToBytes(encrypted)
  );
  console.log("Done writing attendancy to Tangle ... ========".yellow);
  //DEBUGINFO
  // console.log(`Payload : `);
  // console.dir(encrypted);
  console.log("Received Message Id", sendResult.messageId);

  saveInfoToWallet();
}

console.log("E-voting-app".cyan);
let readQRcode = readQR();
console.log(`QRcode from file = ${readQRcode}`.yellow);
let eventQR = prompt("Event QR-code (*=savedversion): ");
if (eventQR === "*") eventQR = readQRcode;

mamInteract(eventQR,personalGender);
