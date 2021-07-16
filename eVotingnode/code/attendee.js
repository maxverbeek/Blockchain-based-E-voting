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
const {checkCredential } = require('./milestone2/auth-verif/node/identity_wasm');

const node = "https://api.hornet-0.testnet.chrysalis2.com";
const commonSideKey =
  "SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSA";

let publicEventRoot = "";
let attendancyAddress = "";
let expdatetime = "";
let eventInformation = "";
let evotingChoice = 0;

// Personal information to calculate the Merkle-root
// const personalFirstName = "Rock";
// const personalSurname = "Smith";
// const personalGender = "Male";
// const personalBirthdate = "08201999";
// const personalMail = "robertsmith@gmail.com";
// const personalDID = "did:example:123456789abcdefghi#key-1";
// const organisation = "International Red Cross";
// for demo-purpose
//const personalMerkleRoot =
  //"ec76f5e70d24137494dbade31136119b52458b19105fd7e5b5812f4de38z82q0";
let eventPersonalMerkleRoot;

function readQR() {
  // Try and load the QR-root from file - as substitute for QRscan from camera
  try {
    const data = fs.readFileSync("./json/QRcode.json", "utf8");
    return data;
  } catch (err) {}
}

function readQR_verifiable_credentials() {
  // Try and load the QR-verifiable credentials from file
  // done to replicate scanning of QR code
  try {
    const data = fs.readFileSync("./milestone2/auth-verif/authenticate/citizen_verifiable_credentials.json", "utf8");
    return data;
  } catch (err) {}
}

function createPersonalMerkleRoot(unique_id){
  let id = unique_id.slice(9);
  let uniqueMerkleRoot = id.toLowerCase();
  //uniqueMerkleRoot.concat(id.toLowerCase());
  uniqueMerkleRoot = uniqueMerkleRoot + id.toLowerCase();
  uniqueMerkleRoot = uniqueMerkleRoot.slice(24);
  return uniqueMerkleRoot;
}

function eligibilty_check(date_of_birth){
  // only checking if the citizen is above 18 years
  // can be changed to according to the organization's requirement
  const age_requirement = 18;
  const year_requirement = new Date().getFullYear();
  if(year_requirement-age_requirement > parseInt(date_of_birth.substr(date_of_birth.length - 4), 10)){
      return true;
    }else{
      return false;
    }
}

async function readQRmam(qrSeed) {
  console.log(qrSeed);
  const mode = "restricted";
  const sideKey = "DATE"; //TODO make it dynamic UTC-date?
  let rootValue = "NON";
  let indexationKey = "";

  let qrRoot = channelRoot(createChannel(qrSeed, 2, mode, sideKey));

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
}

async function readPublicEventInfo(publicEventRoot) {
  const mode = "restricted";
  const sideKey = commonSideKey;

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

function saveInfoToWallet(personalMerkleRoot) {
  // write information about the event to Wallet

  // mr should be constructed from personalInfo
  const payload = {
    // firstname: personalFirstName,
    // lastname: personalSurname,
    // gender: personalGender,
    // birthdate: personalBirthdate,
    // mail: personalMail,
    // organisation: organisation,
    //did: personalDID,
    personal_Merkle_Root: personalMerkleRoot,
    er: publicEventRoot,
  };

  // Store personal eventinformation in Wallet
  // to be used for generating a new verifierQR anytime
  console.log("Save data to wallet >>>>>>>>".green);
  try {
    fs.writeFileSync(
      "./json/personalWallet1.json",
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

async function verifyEligible(citizen_credential) {

  console.log("Eligibilty check..............");
  //console.log(citizen_credential);
  if(citizen_credential){
      console.log("Citizen is eligible");
  }else{
      console.log("Citizen is not eligible");
  }
  
}

//async function mamInteract(eventQR,personalGender) {
async function mamInteract(eventQR,personalMerkleRoot) {
//async function mamInteract(eventQR) {
  // start the whole process

  await readQRmam(eventQR);
  if (publicEventRoot === "NON") {
    console.log("Invalid eventRoot-address".brightred);
    return;
  }
  let nowDate = luxon.DateTime.now();
  let expFromISO = luxon.DateTime.fromISO(expdatetime);

  if (nowDate > expFromISO) {
    // check for expiry of registration - set by organiser: 20? min
    console.log("The event has expired.".brightRed);
    return;
  }
  
  // claim varefication can be done here before storing it into wallet
  // const age_requirement = 18;
  // const year_requirement = new Date().getFullYear();

  // if(year_requirement-age_requirement > parseInt(personalBirthdate.substr(personalBirthdate.length - 4), 10)){
  //   console.log("Claim verification success".green);
  // }else{
  //   console.log("Claim verification failed".red);
  //   return;
  // }


  await readPublicEventInfo(publicEventRoot);
  presentEventInfo(eventInformation);

  // voting choices for the citizen
  console.log("=================================".yellow);
  console.log("Select the desired option for Groningens Ontzet".green);
  console.log("1. Children's program".green);
  console.log("2. Mini Exhibition".green);
  console.log("3. Documentry about the relocation of groningen".green);
  console.log("4. Pub quiz".green);
  console.log("5. Concert".green);
  console.log("6. Harness racing".green);
  evotingChoice = prompt("Vote for the desired event by pressing the corresponding number".yellow);

  const answer = prompt(
    "Would you like to continue with the voted choice or cancel? [Y,n]: ".yellow
  );
  if (answer == "n") {
    return;
  }

  //const payloadRemark = prompt(`Optional remark : `.cyan);

  //TODO hashPersonalInfo
  // setup&calculate merkle-root

  // include publicEventRoot to make this token unique per event
  eventPersonalMerkleRoot = personalMerkleRoot + publicEventRoot;
  const mh2 = await hashHash(eventPersonalMerkleRoot);
  const merkleHash2 = await hashHash(mh2);
  //DEBUGINFO
  console.log("eventPersonalMerkleRoot :".red);
  console.log(eventPersonalMerkleRoot);
  console.log("merkleHash2"+merkleHash2);
  console.log("===========");

  const payload0 = {
    // payload to be stored in MAM
    voterID: merkleHash2,
    votingchoice:evotingChoice,
    //timestamp: new Date().toLocaleString(),
    timestamp: new Date().toUTCString(),
  };

  //DEBUGINFO
  console.log("Payloadcontent ==============".green);
  console.log(payload0);

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
    d: bufferToHex(encrypted2.mac)
  };
  //DEBUGINFO
  //console.log("enc2");
  const encrypted = JSON.stringify(payloadEnc);
  //console.log(encrypted);

  //console.log(`PublicKey : ${eventInformation.eventPublicKey}`.green);
  // const encrypted = attendeeData;

  const sendResult = await sendData(
    client,
    myIndex,
    Converter.utf8ToBytes(encrypted)
  );
  console.log("Done writing attendancy to Tangle ... ========".yellow);
  console.log("Received Message Id", sendResult.messageId);

  saveInfoToWallet(personalMerkleRoot);
}

console.log("E-voting-app".cyan);
let readQRcode = readQR();
console.log(`QRcode from file = ${readQRcode}`.yellow);
let verifiabledata = JSON.parse(readQR_verifiable_credentials());
// create personalized merkele root
let citizen_merkel_root = createPersonalMerkleRoot(verifiabledata.credentialSubject.id);
//console.log(citizen_merkel_root);

// check eligibilty age above18
verifyEligible(verifiabledata.credentialSubject.age_above18);

let eventQR = prompt("Event QR-code (*=savedversion): ");
if (eventQR === "*") eventQR = readQRcode;

//mamInteract(eventQR);
mamInteract(eventQR,citizen_merkel_root);
