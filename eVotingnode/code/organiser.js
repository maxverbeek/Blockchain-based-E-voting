"use strict";
const { bufferToHex, generateKeyPair } = require("eccrypto-js");
const {
  createChannel,
  createMessage,
  mamAttach,
  TrytesHelper,
} = require("@iota/mam.js");
const crypto = require("crypto");
const luxon = require("luxon");
const fs = require("fs");
const prompt = require("prompt-sync")({ sigint: true });
const colors = require("colors");
const { strict } = require("assert");

const node = "https://api.lb-0.testnet.chrysalis2.com/";

// the privatekey and the publickey to encrypt/decrypt attendancy-transaction
const keyPair = generateKeyPair();
const privateOrgPrivateEventKey = keyPair.privateKey;
const publicEventKey = keyPair.publicKey;

// public organiser details hardcoded
const organiserName = "Groningen Ltd.";
const organiserAddress = "Vrydemalaan 2";
const organiserPostcode = "9713 WS";
const organiserCity = "Groningen";
const organiserURL = "http://groningen.com";
const organiserTelephone = "01 234 56 789";
const organiserMail = "info@groningen.com";
const organiserDID = "did:example:342159687abcdefghi#key-1";

// public event details hardcoded
const privateOrgPrivateTitle = "Groningens organizers";
const eventName = "Groningens Ontzet event organization";
const eventDate = "April 28th 2021";
const eventTime = "08:00 - 16:30";
const eventLocation = "Online";

let eventSEED = "";
let organiserKey = "";
let channelState;
// demo-sidekey
const commonSideKey =
  "SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSA";

let attendeeQRcode = "";
let attendanceNotificationKey = "";

const payload0 = {
  // Information for the private-organiser-Mam-record

  title: privateOrgPrivateTitle,
  timestamp: luxon.DateTime.now().toISO(),
  ePKey: bufferToHex(privateOrgPrivateEventKey),
};

const payload1 = {
  // Information for the 1st public-Mam-record
  orgname: organiserName,
  orgaddress: organiserAddress,
  orgzip: organiserPostcode,
  orgcity: organiserCity,
  orgtel: organiserTelephone,
  orgmail: organiserMail,
  orgurl: organiserURL,
  orgdid: organiserDID,
  eventname: eventName,
  eventloc: eventLocation,
  eventdate: eventDate,
  eventtime: eventTime,
  eventPublicKey: bufferToHex(publicEventKey),
};

function generateSeed(length) {
  // Random string A-Z,9 -for seeds
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ9";
  let seed = "";
  while (seed.length < length) {
    const byte = crypto.randomBytes(1);
    if (byte[0] < 243) {
      seed += charset.charAt(byte[0] % 27);
    }
  }
  return seed;
}

function saveChannelState() {
  // Store the channel state so we can use it in evenclose.js
  console.log("Save channelstate >>>>>>>>".green);
  try {
    fs.writeFileSync(
      "./json/channelState.json",
      JSON.stringify(channelState, undefined, "\t")
    );
  } catch (e) {
    console.error(e);
  }
}

function saveQR(qrcode) {
  // save QRcode so we can use it in attendee.js
  console.log("Save QRcode >>>>>>>>".green);
  try {
    fs.writeFileSync("./json/QRcode.json", qrcode);
  } catch (e) {
    console.error(e);
  }
}

function saveSEEDnPassword() {
  // save eventSEED and eventPassword in (imaginery) organiserswallet

  const eventWalletInfo = `{
    "seed":"${eventSEED}",
    "password":"${organiserKey}",
    "indexation":"${attendanceNotificationKey}",
    "aQR":"${attendeeQRcode}"
  }`;

  console.log("Save EventSEED >>>>>>>>".green);
  try {
    fs.writeFileSync("./json/Wallet.json", eventWalletInfo);
  } catch (e) {
    console.error(e);
  }
}

async function setupMam(payload) {
  // add Organiser-Privatemessage to MAM
  const mode = "restricted";
  const sideKey = organiserKey;

  channelState = createChannel(eventSEED, 2, mode, sideKey);
  const mamMessage = createMessage(
    channelState,
    TrytesHelper.fromAscii(JSON.stringify(payload))
  );

  console.log("Event Organizer Payload >>>>>".red);
  console.log(JSON.stringify(payload));
  console.log(">>>>>>>>>>>>".red);
  // Attach the message.
  console.log("Attaching >>>>>>>>>>>".red);
  console.log("Attaching private-Event message to tangle, please wait...");
  const { messageId } = await mamAttach(node, mamMessage, "SSA9EXPERIMENT");
  console.log(`Message Id`, messageId);
  console.log(
    `You can view the mam channel here : 
    \nhttps://explorer.iota.org/testnet/streams/0/${mamMessage.root}/${mode}/${sideKey}`
  );
  console.log("===============================".yellow);
}

async function addEvent2Mam(payload) {
  // add Event-message to MAM
  const mode = "restricted";
  const sideKey = commonSideKey;

  channelState.sideKey = commonSideKey;
  console.log("Payload =================".red);
  console.log(JSON.stringify(payload));

  const mamMessage = createMessage(
    channelState,
    TrytesHelper.fromAscii(JSON.stringify(payload))
  );

  // Attach the message.
  console.log("Attaching =================".red);
  console.log("Attaching Eventmessage to tangle, please wait...");
  const { messageId } = await mamAttach(node, mamMessage, "SSA9EXPERIMENT");
  console.log(`Message Id`, messageId);
  console.log(
    `You can view the mam channel here : \nhttps://explorer.iota.org/testnet/streams/0/${mamMessage.root}/${mode}/${sideKey}`
  );
  console.log("===============================".yellow);
}

async function makeQRmam(
  publicEventRoot,
  attendanceNotificationKey,
  expiryDateTime
) {

  const mode = "restricted";
  const sideKey = "DATE"; 
  let channelQRState;

  const payloadQR = {
    root: publicEventRoot,
    indexation: attendanceNotificationKey,
    expirytimestamp: expiryDateTime,
  };

  console.log("PayloadQR =================".red);
  console.log(payloadQR);
  console.log("=================".red);

  attendeeQRcode = "SSA" + generateSeed(78);
  console.log(`Attendee QR-seed : ${attendeeQRcode}`.cyan);
  console.log(`You can use this QR-code to attend the E-voting event :`);
  console.log(
    `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${attendeeQRcode}`
      .yellow
  );
  channelQRState = createChannel(attendeeQRcode, 2, mode, sideKey);

  const mamMessage = createMessage(
    channelQRState,
    TrytesHelper.fromAscii(JSON.stringify(payloadQR))
  );

  // SEED    : plus sidekey?!
  saveQR(attendeeQRcode); 


  // Attach the message.
  console.log("Attaching =================".red);
  console.log("Attaching Eventmessage to tangle, please wait...");
  // tag -SSA9EXPERIMENTQR- can be used lateron for storing on permanode
  const { messageId } = await mamAttach(node, mamMessage, "SSA9EXPERIMENTQR");
  console.log(`Message Id`, messageId);
  console.log(
    `You can view the mam channel here : \nhttps://explorer.iota.org/testnet/streams/0/${mamMessage.root}/${mode}/${sideKey}`
  );
  console.log("===============================".yellow);
}

function makeMamEntryPointAttendee() {
  const publicEventRoot = channelState.nextRoot;
  //HINT make expirydelay a variable
  const expiryDateTime = luxon.DateTime.now().plus({ minutes: 15 }); // to be set by organiser

  attendanceNotificationKey = generateSeed(64);
  makeQRmam(
    channelState.nextRoot,
    attendanceNotificationKey,
    expiryDateTime.toISO()
  );

  addEvent2Mam(payload1);
  // save nextroot to append attendee-list in closeevent.js
  saveChannelState();
  saveSEEDnPassword();
}

console.log("E-voting Application".cyan);
// Unique SEED per event
eventSEED = prompt(
  "Event SEED -81 UPPERCASE A-Z,9- (*=random-auto-generate): "
);
// password for the private organiser MAMrecord (first record in the MAM)
organiserKey = prompt(
  "Secure organiserKey -UPPERCASE A-Z,9- (*=default for demo): "
);

if (eventSEED === "*") {
  // generate default for debugging -for lazy people-
  eventSEED = generateSeed(81);
}
if (organiserKey === "*") {
  // for first record of MAM (which is private)
  // for extra encrypting the record which holds the eventPrivatekey
  organiserKey = commonSideKey;
}

async function run() {
  // interact with IOTA-MAM-V0
  // setupMam(payload0).then(() => makeMamEntryPointAttendee());
  await setupMam(payload0);
  await makeMamEntryPointAttendee();
}

// saveSEEDnPassword();
console.log(`EventSEED = ${eventSEED}`.green);
console.log(`OrganiserKey = ${organiserKey}`.green);
console.log(
  `PrivateEventKey = ${privateOrgPrivateEventKey.toString("hex")}`.cyan
);
console.log(`PublicEventKey = ${publicEventKey.toString("hex")}`.cyan);

run();
