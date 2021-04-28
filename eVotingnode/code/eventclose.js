//////////////////////////////////////////////////////////
// Organiser eventclose-app
// (c) A.J. Wischmann 2021
//////////////////////////////////////////////////////////
"use strict";

const { bufferToHex, hexToBuffer, decrypt } = require("eccrypto-js");
const eccryptoJS = require("eccrypto-js");
const {
  createChannel,
  createMessage,
  mamAttach,
  mamFetch,
  TrytesHelper,
  channelRoot,
  mamFetchAll,
} = require("@iota/mam-chrysalis.js");
const { retrieveData, SingleNodeClient, Converter } = require("@iota/iota.js");
const luxon = require("luxon");
const fs = require("fs");
const prompt = require("prompt-sync")({ sigint: true });
const colors = require("colors");

let walletState;
const node = "https://api.hornet-0.testnet.chrysalis2.com";
const commonSideKey =
  "SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSA";
let privateSideKey = "";
let privateOrgPrivateEventKey = "";
let attendancyAddress = "";
let nextMAMRoot = "";
let eventInformation = "";
let mamOpen = true;
let publicEventRoot = "";
let channelState = "";

async function readWallet() {
  // Try and load the wallet state from json file
  try {
    const currentState = fs.readFileSync("./json/Wallet.json");
    if (currentState) {
      walletState = JSON.parse(currentState.toString());
    }
  } catch (e) {}
  privateSideKey = walletState.password;
  attendancyAddress = walletState.indexation;
}

async function readPrivateOrganiserInfo() {
  const mode = "restricted";
  const sideKey = privateSideKey;

  let root = channelRoot(createChannel(walletState.seed, 2, mode, sideKey));
  //DEBUGINFO
  // console.log("Fetching from tangle with this information :");
  // console.log(`Node : ${node}`.yellow);
  // console.log(`EventRoot : ${root}`.yellow);
  // console.log(`mode : ${mode}`.yellow);
  // console.log(`sideKey : ${sideKey}`.yellow);

  // Try fetching from MAM
  console.log(
    "Fetching privateOrganiserInformation from tangle, please wait..."
  );
  const fetched = await mamFetch(node, root, mode, sideKey);
  if (fetched) {
    let fMessage = JSON.parse(TrytesHelper.toAscii(fetched.message));
    // console.log("Fetched : ", fMessage);
    const eventTitle = fMessage.title;
    privateOrgPrivateEventKey = hexToBuffer(fMessage.ePKey);
    publicEventRoot = fetched.nextRoot;
  } else {
    console.log("Nothing was fetched from the MAM channel");
  }
  //DEBUGINFO
  // console.log("MAMdata ===================".red);
  // console.log(`fetched : ${fetched.message}`.green);
}

async function readPublicEventInfo() {
  const mode = "restricted";
  const sideKey = commonSideKey;

  //DEBUGINFO
  // console.log(
  //   "Fetching publicEventInformation from tangle with this information :"
  // );
  // console.log(`Node : ${node}`.yellow);
  // console.log(`EventRoot : ${publicEventRoot}`.yellow);
  // console.log(`mode : ${mode}`.yellow);
  // console.log(`sideKey : ${sideKey}`.yellow);

  // Try fetching from MAM
  console.log("Fetching publicEventInfo from tangle, please wait...");
  const fetched = await mamFetch(node, publicEventRoot, mode, sideKey);
  if (fetched) {
    let fMessage = JSON.parse(TrytesHelper.toAscii(fetched.message));
    eventInformation = fMessage;
    nextMAMRoot = fetched.nextRoot;
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

async function attendeeList(attIndexation) {
  // retrieve a raw list of attendeetransactions
  const client = new SingleNodeClient(node);
  // console.log(`attendeeList : ${attIndexation}`.green);
  const found = await client.messagesFind(attIndexation);
  return found;
}

async function showAlist(attendeeIndex) {
  // show attendeeTransactionList

  console.log("===============".red);
  const mList = await attendeeList(attendeeIndex);
  for (let i = 0; i < mList.count; i++) {
    console.log(`${i + 1} : ${mList.messageIds[i]}`);
  }
  // showAttendeeCount
  console.log(`Total : ${mList.count} ===============`.green);
}

async function getAttendee(attendeeMessageID) {
  // retrieve attendeeTransaction from Tangle
  const client = new SingleNodeClient(node);
  // console.log(`Retrieving : ${attendeeMessageID}`.dim);
  const transactionDataRAW = await retrieveData(client, attendeeMessageID);
  const transactionData = JSON.parse(
    Converter.bytesToUtf8(transactionDataRAW.data)
  );
  //DEBUGINFO
  // console.log(`Raw : ${transactionData}`);
  // console.dir(transactionData);

  if (transactionData) {
    const encryptedData = {
      iv: hexToBuffer(transactionData.a),
      ephemPublicKey: hexToBuffer(transactionData.b),
      ciphertext: hexToBuffer(transactionData.c),
      mac: hexToBuffer(transactionData.d),
    };
    const decrypted = await decrypt(privateOrgPrivateEventKey, encryptedData);
    return decrypted;
  }
}

async function detailedList(attendeeIndex) {
  // show list of attendees with details
  const idList = [];
  const aList = await attendeeList(attendeeIndex);
  // readAttendeeRecord, decrypt, extract AttendeeID, timestamp
  for (let i = 0; i < aList.count; i++) {
    let attendeeToken = await getAttendee(aList.messageIds[i]);
    let aTokenJson = JSON.parse(attendeeToken);
    console.log(aTokenJson);
    if (idList.indexOf(aTokenJson.attendeeID) === -1) {
      idList.push(aTokenJson.attendeeID);
      console.log(
        `${i + 1} : ${aList.messageIds[i]} \n\t ${aTokenJson.attendeeID} - ${
          aTokenJson.remark
        } - ${aTokenJson.timestamp}`
      );
    } else {
      console.log(
        `${i + 1} : ${aList.messageIds[i]} - DOUBLE ID - \n\t ${
          aTokenJson.attendeeID
        } - ${aTokenJson.remark} - ${aTokenJson.timestamp}`.brightRed
      );
    }
  }
  console.log(`Total unique IDs : ${idList.length} =========`.green);
}

async function writeCloseMessage(mamChannelState) {
  // appendCloseMessage -include closingTimestamp
  const mode = "restricted";
  const sideKey = commonSideKey;

  let nowTime = luxon.DateTime.now();

  const payloadClose = {
    message: "Event closed",
    date: nowTime.toISO(),
  };

  const mamCloseMessage = createMessage(
    mamChannelState,
    TrytesHelper.fromAscii(JSON.stringify(payloadClose))
  );

  // writeMAMstate for appending extra information
  try {
    fs.writeFileSync(
      "./json/channelState.json",
      JSON.stringify(mamChannelState, undefined, "\t")
    );
  } catch (e) {
    console.error(e);
  }

  // Attach the closing message.
  console.log("Attaching =================".red);
  console.log("Attaching closingMessage to tangle, please wait...");
  const { messageId } = await mamAttach(
    node,
    mamCloseMessage,
    "SSA9EXPERIMENT"
  );
  console.log(`Message Id`, messageId);
  console.log(
    `You can view the mam channel here \n https://explorer.iota.org/chrysalis/streams/0/${mamCloseMessage.root}/${mode}/${sideKey}`
  );
}

async function closeEvent(attendeeIndex) {
  // makelist, writeList2MAM, writeCloseMessage
  const mode = "restricted";
  const sideKey = commonSideKey;

  const attList = [];
  const aList = await attendeeList(attendeeIndex);
  // readAttendeeRecord, decrypt, extract AttendeeID, add2List
  for (let i = 0; i < aList.count; i++) {
    let attendeeToken = await getAttendee(aList.messageIds[i]);
    let aTokenJson = JSON.parse(attendeeToken);
    // add to list if unique
    if (attList.indexOf(aTokenJson.attendeeID) === -1) {
      attList.push(aTokenJson.attendeeID);
    }
  }
  // appendAttendeeList2MAM
  const payloadDataRec = {
    count: attList.length,
    ids: attList,
  };
  // console.log("AttendeeListRec ===============".red);
  // console.log(payloadDataRec);

  // loadchannelState from imaginary organiserWallet
  try {
    const currentState = fs.readFileSync("./json/channelState.json");
    if (currentState) {
      channelState = JSON.parse(currentState.toString());
    }
  } catch (e) {
    console.error(e);
  }

  const mamMessage = createMessage(
    channelState,
    TrytesHelper.fromAscii(JSON.stringify(payloadDataRec))
  );
  //DEBUGINFO
  // Display the details for the MAM message.
  // console.log("=================".red);
  // console.log("Seed:", channelState.seed);
  // console.log("Address:", mamMessage.address);
  // console.log("Root:", mamMessage.root);
  // console.log("NextRoot:", channelState.nextRoot);

  // Attach the message.
  console.log("Attaching =================".red);
  console.log("Attaching attendeeListMessage to tangle, please wait...");
  const { messageId } = await mamAttach(node, mamMessage, "SSA9EXPERIMENT");
  console.log(`Message Id`, messageId);
  console.log(
    `You can view the mam channel here \n https://explorer.iota.org/chrysalis/streams/0/${mamMessage.root}/${mode}/${sideKey}`
  );
  console.log("===============================".yellow);
  await writeCloseMessage(channelState);
  console.log("===============================".yellow);
  console.log("-- Event closed by organiser --".cyan);
  mamOpen = false;
}

async function mamClosedStatus() {
  // check if event was already closed or stil open
  const mode = "restricted";
  const sideKey = commonSideKey;

  console.log("Checking if event was closed..".yellow);
  let mamOpenStatus = true;
  let fMessage = "";
  const fetched = await mamFetchAll(node, publicEventRoot, mode, sideKey);
  if (fetched && fetched.length > 0) {
    for (let i = 0; i < fetched.length; i++) {
      const element = fetched[i].message;
      fMessage = JSON.parse(TrytesHelper.toAscii(element));
      if (fMessage.message == "Event closed") mamOpenStatus = false;
    }
  }
  if (mamOpenStatus) console.log(`Event is still open`.brightGreen);
  else
    console.log(`Event was closed at : ${fMessage.date}`.brightRed);
  return mamOpenStatus;
}

async function officialAttendeeList() {
  //show list with attendeeTokens
  const mode = "restricted";
  const sideKey = commonSideKey;
  console.log(`Getattendees ===========`.red);
  let aList = [];
  //DEBUGINFO
  // console.log("Fetching attendeeIDs from tangle with this information :");
  // console.log(`Node : ${node}`.yellow);
  // console.log(`EventRoot : ${nextMAMRoot}`.yellow);
  // console.log(`mode : ${mode}`.yellow);
  // console.log(`sideKey : ${sideKey}`.yellow);

  // Try fetching from MAM
  let readMAM = true;
  let aListRoot = nextMAMRoot;
  while (readMAM) {
    // readMAMrecord
    // console.log("ReadMAM ===========".red);
    const fetched = await mamFetch(node, aListRoot, mode, sideKey);
    // console.log(`fetched : ${fetched.message}`.green);
    if (fetched) {
      let fMessage = JSON.parse(TrytesHelper.toAscii(fetched.message));
      aListRoot = fetched.nextRoot;
      //DEBUGINFO
      //   console.log("MAMdata ===================".red);
      //   console.log(`fetched : ${fMessage.count}`.green);
      if (fMessage.message == "Event closed") {
        console.log(
          `Event closed at : ${fMessage.date} =====`.cyan
        );
        readMAM = false;
      } else {
        aList = aList.concat(fMessage.ids);
        // console.log("attendeeList ========");
        // console.log(`aList : ${aList}`.yellow);
      }
    }
  }
  for (const x in aList) {
    console.log(`AttendeeToken ${1 + parseInt(x)} : ${aList[x]}`);
  }
  console.log(`Total attendees : ${aList.length}`.green);
}

async function run() {
  console.log("Event-close-app".cyan);
  readWallet();
  //DEBUGINFO
  // console.log("Wallet".red);
  // console.log(`EventSEED  : ${walletState.seed}`);
  // console.log(`Password   : ${walletState.password}`);
  // console.log(`Indexation : ${walletState.indexation}`);
  // console.log(`AttendeeQR : ${walletState.aQR}`);

  // extractPrivateEventKey
  await readPrivateOrganiserInfo();
  await readPublicEventInfo();
  // show EventInformation
  presentEventInfo(eventInformation);
  // check & show if event was already closed
  mamOpen = await mamClosedStatus();

  console.log("=================================================".green);
  let theEnd = false;
  while (!theEnd) {
    let promptString = "Menu: [t]-Tanglelist, [d]-detailedTanglelist";
    promptString += mamOpen ? ", [c]-close" : ",  [a]-attendeelist";
    promptString += ", [q]-quit : ";
    let menuChoice = prompt(promptString.yellow);
    if (menuChoice == "t") {
      // show current list of transactions on the Tangle
      await showAlist(attendancyAddress);
    }
    if (menuChoice == "d") {
      // show the details of the current transactions on the Tangle
      await detailedList(attendancyAddress);
    }
    if (menuChoice == "a" && !mamOpen) {
      // show the list of official decrypted attendeeTokens
      await officialAttendeeList();
    }
    if (menuChoice == "c" && mamOpen) {
      // close the event and write the official attendeelist
      await closeEvent(attendancyAddress);
    }
    if (menuChoice == "q") {
      // exit the application
      theEnd = true;
    }
  }
}

run();
