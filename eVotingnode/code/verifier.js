"use strict";

const { mamFetchAll, TrytesHelper } = require("@iota/mam.js");
const { Converter } = require("@iota/iota.js");
const { sha256, utf8ToBuffer, bufferToHex } = require("eccrypto-js");
const luxon = require("luxon");
const fs = require("fs");
const prompt = require("prompt-sync")({ sigint: true });
const colors = require("colors");

//const node = "https://api.hornet-0.testnet.chrysalis2.com";
const node = "https://api.lb-0.testnet.chrysalis2.com";
const commonSideKey =
  "SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSA";
let publicEventRoot = "";
let attendeeToken = "";
let qrTime = "";
let eventInformation = "";
let mamClosedTime = "";
let personalInfo = "";

async function hashHash(hashData) {
  let element = await sha256(utf8ToBuffer(hashData));
  return bufferToHex(element);
}

function getEventInfo(mamData) {
  // convert from MAM to JSON
  console.log(mamData);
  let fMessage = JSON.parse(TrytesHelper.toAscii(mamData.message));
  return fMessage;
}

// readAttendeeQR
function readQR() {
  // Try and load the QR-root from file - as substitute for QRscan from camera
  try {
    const data = fs.readFileSync("./json/verifierQR.json", "utf8");
    return data;
  } catch (err) {}
}

async function checkQR(code) {
  // check integrity of QR-code

  let codeLength = code.length;
  if (codeLength > 164) {
    // length indicates personalInformation is included
    personalInfo = code.slice(0, codeLength - 164);
    code = code.slice(-164);
  }
  //console.log("before"+code);
  code = degarble(code);
  //console.log("after"+code);
  let crccode = code.slice(-5).toLowerCase();
  let idstring = code.slice(0, 64).toLowerCase();
  let rootcode = code.slice(64, -18);
  let timecode = code.slice(-18, -5);
  let rest = idstring + rootcode + timecode + personalInfo + "SSAsaltQ3v%";
  let crcValueString = await hashHash(rest);
  let crcValue = crcValueString.slice(-5);
  if (crccode == crcValue) {
    publicEventRoot = rootcode;
    console.log(publicEventRoot);
    attendeeToken = await hashHash(idstring);
    //console.log(`attendeeToken :${attendeeToken}`);
    qrTime = luxon.DateTime.fromMillis(parseInt(timecode));
    let nowTime = luxon.DateTime.now();
    let timeDiff = nowTime.diff(qrTime);
    if (timeDiff.as(`minutes`) > 5)
      console.log(
        `Suspicious behaviour : QR-code is older than 5 minutes!`.underline
          .brightRed
      );
    console.log(
      `QR-code was generated ${parseInt(
        timeDiff.as(`minutes`)
      )} minutes ago at: ${qrTime.toISO()}`.yellow
    );
    return true;
  }
  console.log("-- QR code is incorrect! --".red);
  return false;
}

async function readWholeMam(startingRoot) {
  // read ALL Mamrecords into memory
  const mode = "restricted";
  const sideKey = commonSideKey;

  console.log("Fetching eventinformation....".yellow);
  const fetched = await mamFetchAll(node, startingRoot, mode, sideKey);
  //console.log("fetched"+fetched);
  return fetched;
}

function mamStillOpenStatus(allMamData) {
  // check if event was already closed or stil open
  let mamOpenStatus = true;
  for (let i = 0; i < allMamData.length; i++) {
    const element = allMamData[i].message;
    let mamRecord = JSON.parse(TrytesHelper.toAscii(element));
    if (mamRecord.message == "Event closed") {
      mamOpenStatus = false;
      mamClosedTime = mamRecord.date;
    }
  }
  return mamOpenStatus;
}

function presentEventInfo(eventRecord) {
  console.log("Eventinformation =================================".red);
  console.log("Event :".cyan);
  console.log(`Name : ${eventRecord.eventname}`);
  console.log(`Date : ${eventRecord.eventdate}`);
  console.log(`Time : ${eventRecord.eventtime}`);
  console.log(`Location : ${eventRecord.eventloc}`);
  console.log("=================================".red);
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

function loadAttendeeTokens(mamAttendeeMessage) {
  // readAttendeeList -till ClosedMessage
  let aList = [];

  let fMessage = getEventInfo(mamAttendeeMessage);
  aList = aList.concat(fMessage.ids);
  // console.log("attendeeList ========");
  // console.log(`aList : ${aList}`.yellow);

  return aList;
}

function checkAttended(ID, idList) {
  // check if voterID is on the list of registeredIDs
  if (idList.indexOf(ID) === -1) {
    console.log(`ID : ${ID} has not voted for this E-voting event!`.brightRed);
    return false;
  } else {
    console.log(`ID : ${ID} has voted for this E-voting event.`.green);
    return true;
  }
}

function degarble(txt) {
  // decrypts and unshifts

  let base = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let dict = "5TXY6VWD8BEF7CUHI2RSZ34LM9ANOGJK01PQ";
  let key = txt.slice(-1);
  let cipherwaarde = dict.indexOf(key);

  let z = "";
  for (let i = 0; i < txt.length - 1; i++) {
    let letter = dict.indexOf(txt[i]) - cipherwaarde;
    if (letter < 0) letter += 36;
    z += base[letter];
  }
  let shifter = cipherwaarde % 31;
  let arretje = z.split("");
  for (let s = 0; s < shifter; s++) {
    let l = arretje.pop();
    arretje.unshift(l);
  }
  z = arretje.join("");
  return z;
}

async function run() {
  console.log("E-voting-verifier-app".cyan);
  let verificationQR = readQR();
  console.log(`VerificationQR : ${verificationQR}`.green);
  let eventQR = prompt("Verification QR-code (*=savedversion): ");
  if (eventQR === "*") eventQR = verificationQR;

  let qrOkay = await checkQR(eventQR);
  if (!qrOkay) {
    console.log("-- Verification aborted --".red);
    return;
  } else {
    // readEventInfo
    let allMamData = await readWholeMam(publicEventRoot);
    //console.log("check123");
    //console.log(allMamData);
    eventInformation = getEventInfo(allMamData[0]);
    //console.log("check2");
    if (eventInformation.eventPublicKey.length > 0) {
      // show eventinfo
      presentEventInfo(eventInformation);
      if (mamStillOpenStatus(allMamData)) {
        console.log(
          `Event is open at this moment, no check possible.`
            .brightRed
        );
        return;
      }
      console.log(`The event was closed at : ${mamClosedTime}`);

      const attendeeList = loadAttendeeTokens(allMamData[1]);
      // checkAttendeeOnList
      if (personalInfo) {
        console.log(
          `Included personalinformation : ${personalInfo.slice(0, -2)}`.yellow
        );
      } else {
        console.log(`NO personal information was included`.red);
      }

      checkAttended(attendeeToken, attendeeList);
    }
  }
}

run();
