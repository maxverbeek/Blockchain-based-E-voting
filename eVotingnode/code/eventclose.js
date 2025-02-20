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
} = require("@iota/mam.js");
const { retrieveData, SingleNodeClient, Converter } = require("@iota/iota.js");
const luxon = require("luxon");
const fs = require("fs");
const prompt = require("prompt-sync")({ sigint: true });
const colors = require("colors");

let walletState;
//const node = "https://api.hornet-0.testnet.chrysalis2.com";
const node = "https://api.lb-0.testnet.chrysalis2.com";
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
}

async function readPublicEventInfo() {
  const mode = "restricted";
  const sideKey = commonSideKey;

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
  // readAttendeeRecord, decrypt, extract voterID, timestamp
  for (let i = 0; i < aList.count; i++) {
    let attendeeToken = await getAttendee(aList.messageIds[i]);
    let aTokenJson = JSON.parse(attendeeToken);
    if (idList.indexOf(aTokenJson.voterID) === -1) {
      idList.push(aTokenJson.voterID);
      console.log(
        `${i + 1} : ${aList.messageIds[i]} \n\t ${aTokenJson.voterID} - ${
          aTokenJson.votingchoice
        } - ${aTokenJson.timestamp}`
      );
    } else {
      console.log(
        `${i + 1} : ${aList.messageIds[i]} - DOUBLE ID - \n\t ${
          aTokenJson.voterID
        } - ${aTokenJson.votingchoice} - ${aTokenJson.timestamp}`.brightRed
      );
    }
  }
  console.log(`Total unique IDs : ${idList.length} =========`.green);
}

async function voteCount(attendeeIndex){
  //checking if MAM is closed
  const mode = "restricted";
  const sideKey = commonSideKey;
  let vList = [];
  let readMAM = true;
  let aListRoot = nextMAMRoot;
  const voterList = await attendeeList(attendeeIndex);
  const finalvoterList = await getofficialVotingChoiseList(attendeeIndex);
  const idList = await getVoterListMAM();
  //console.log(idList);
  while (readMAM) {
    const fetched = await mamFetch(node, aListRoot, mode, sideKey);
    if (fetched) {
      let fMessage = JSON.parse(TrytesHelper.toAscii(fetched.message));
      aListRoot = fetched.nextRoot;
      if (fMessage.message == "Event closed") {
        console.log(
          `Voting Event closed at : ${fMessage.date} =====`.cyan
        );
        readMAM = false;
        for(let i =0;i<finalvoterList.length;i++){
          if(idList.indexOf(finalvoterList[i].voter_id)!=-1){
            vList.push(finalvoterList[i].choice);
          }
        }
        console.log("Voting results >>>>>>>>>");
        console.log("Number of votes for option 1 is "+ vList.filter(x =>x === '1').length);
        console.log("Number of votes for option 2 is "+vList.filter(x =>x === '2').length);
        console.log("Number of votes for option 3 is "+vList.filter(x =>x === '3').length);
        console.log("Number of votes for option 4 is "+vList.filter(x =>x === '4').length);
        console.log("Number of votes for option 5 is "+vList.filter(x =>x === '5').length);
        console.log("Number of votes for option 6 is "+vList.filter(x =>x === '6').length);
        return;
      }
    }
  }
}


async function voterList(attendeeIndex) {
  // show list of attendees with details
  const idList = [];
  const aList = await attendeeList(attendeeIndex);
  // readAttendeeRecord, decrypt, extract voterID, timestamp
  for (let i = 0; i < aList.count; i++) {
    let attendeeToken = await getAttendee(aList.messageIds[i]);
    let aTokenJson = JSON.parse(attendeeToken);
    //console.log(aTokenJson);
      idList.push(aTokenJson.voterID);
      console.log(
        `${i + 1} : \t ${aTokenJson.voterID}`);
  }
  console.log(`Total  voting IDs : ${idList.length} =========`.green);
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
    `You can view the mam channel here \n https://explorer.iota.org/testnet/streams/0/${mamCloseMessage.root}/${mode}/${sideKey}`
  );
}

async function closeEvent(attendeeIndex) {
  // makelist, writeList2MAM, writeCloseMessage
  const mode = "restricted";
  const sideKey = commonSideKey;
  const attList = [];
  const aList = await attendeeList(attendeeIndex);
  // readAttendeeRecord, decrypt, extract voterID, add2List
  for (let i = 0; i < aList.count; i++) {
    let attendeeToken = await getAttendee(aList.messageIds[i]);
    let aTokenJson = JSON.parse(attendeeToken);
    // add to list if unique
    if (attList.indexOf(aTokenJson.voterID) === -1) {
      attList.push(aTokenJson.voterID);
    }
  }
  // appendAttendeeList2MAM
  const payloadDataRec = {
    count: attList.length,
    ids: attList,
  };
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
  // Attach the message.
  console.log("Attaching =================".red);
  console.log("Attaching attendeeListMessage to tangle, please wait...");
  const { messageId } = await mamAttach(node, mamMessage, "SSA9EXPERIMENT");
  console.log(`Message Id`, messageId);
  console.log(
    `You can view the mam channel here \n https://explorer.iota.org/testnet/streams/0/${mamMessage.root}/${mode}/${sideKey}`
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
  console.log(node);
  console.log(publicEventRoot);
  console.log(mode);
  console.log(sideKey);
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
  console.log(`Get attendees ===========`.red);
  let aList = [];
  let readMAM = true;
  let aListRoot = nextMAMRoot;
  while (readMAM) {
    const fetched = await mamFetch(node, aListRoot, mode, sideKey);
    if (fetched) {
      let fMessage = JSON.parse(TrytesHelper.toAscii(fetched.message));
      aListRoot = fetched.nextRoot;
      if (fMessage.message == "Event closed") {
        console.log(
          `Event closed at : ${fMessage.date} =====`.cyan
        );
        readMAM = false;
      } else {
        aList = aList.concat(fMessage.ids);
      }
    }
  }
  for (const x in aList) {
    console.log(`Voter Token ${1 + parseInt(x)} : ${aList[x]}`);
  }
  console.log(`Total final voter : ${aList.length}`.green);
}

async function getVoterListMAM() {
  //show list with attendeeTokens
  const mode = "restricted";
  const sideKey = commonSideKey;
  let aList = [];
  // Try fetching from MAM
  let readMAM = true;
  let aListRoot = nextMAMRoot;
  while (readMAM) {
    const fetched = await mamFetch(node, aListRoot, mode, sideKey);
    // console.log(`fetched : ${fetched.message}`.green);
    if (fetched) {
      let fMessage = JSON.parse(TrytesHelper.toAscii(fetched.message));
      aListRoot = fetched.nextRoot;
      if (fMessage.message == "Event closed") {
        readMAM = false;
      } else {
        aList = aList.concat(fMessage.ids);
      }
    }
  }
  return aList;
}

async function getofficialVotingChoiseList(attendeeIndex) {
  // show list of attendees with details
  const idList = [];
  const finalList =[];
  const countList =[];
  const aList = await attendeeList(attendeeIndex);
  // readAttendeeRecord, decrypt, extract voterID, timestamp
  for (let i = 0; i < aList.count; i++) {
    let attendeeToken = await getAttendee(aList.messageIds[i]);
    let aTokenJson = JSON.parse(attendeeToken);
      finalList.push({"voter_id":aTokenJson.voterID,
      "choice":aTokenJson.votingchoice,"timestamp":aTokenJson.timestamp});
  }  
  // sort the voter list
  finalList.sort(function (a,b){
    if(a.timestamp < b.timestamp){
      return -1;
    }
  })
  // find uniques
  for (let i = 0; i < finalList.length; i++) {
    if (idList.indexOf(finalList[i].voter_id) === -1) {
      idList.push(finalList[i].voter_id);
      countList.push(finalList[i]);  
    }
  }
  return countList;
}

async function run() {
  console.log("Event-close-app".cyan);
  readWallet();

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
    let promptString = "Menu: [l]-live voterList";
    promptString += mamOpen ? ", [c]-close" : ",  [f]-finalvoterList, [v] - count vote";
    promptString += ", [q]-quit : ";
    // let promptString = "Menu: [t]-Tanglelist, [d]-detailedTanglelist , [v]-voterlist";
    // promptString += mamOpen ? ", [c]-close" : ",  [a]-attendeelist";
    // promptString += ", [q]-quit : ";
    let menuChoice = prompt(promptString.yellow);
    // if (menuChoice == "t") {
    //   // show current list of transactions on the Tangle
    //   await showAlist(attendancyAddress);
    // }
    if (menuChoice == "d") {
      // show the details of the current transactions on the Tangle
      await detailedList(attendancyAddress);
    }
    if (menuChoice == "l") {
      // show the current list of voter on the Tangle
      await voterList(attendancyAddress);
    }
    if (menuChoice == "f" && !mamOpen) {
      // show the list of official decrypted attendeeTokens
      await officialAttendeeList();
    }
    if (menuChoice == "c" && mamOpen) {
      // close the event and write the official attendeelist
      await closeEvent(attendancyAddress);
    }
    if (menuChoice == "v" && !mamOpen) {
      // close the event and counting the vote
      await voteCount(attendancyAddress);
    }
    if (menuChoice == "q") {
      // exit the application
      theEnd = true;
    }
  }
}

run();
