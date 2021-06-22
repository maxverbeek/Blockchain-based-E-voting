const {checkCredential } = require('../node/identity_wasm');
const fs = require("fs");

function readQR() {
    // Try and load the QR-verifiable credentials from file
    // done to replicate scanning of QR code
    try {
      const data = fs.readFileSync("citizen_verifiable_credentials.json", "utf8");
      return data;
    } catch (err) {}
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

async function run() {

    const CLIENT_CONFIG = {
        network: "main",
        node: "https://chrysalis-nodes.iota.org:443",
        } 

    let verifiabledata = readQR();
    if(verifiabledata==null){
        console.log("No data");
    }
    const result = await checkCredential(verifiabledata, CLIENT_CONFIG);
    if(result.verified){
        console.log("Identity is authenticated");
    }
    else
        console.log("Identity is not authenticated");
    
    console.log("Eligibilty check..............");
    let eligibilty = eligibilty_check(result.credential.credentialSubject.birthdate);
    if(eligibilty){
        console.log("Citizen is eligible");
    }else{
        console.log("Citizen is not eligible");
    }

    //console.log("*********************result**************");
    //console.log(result.credential.credentialSubject.age);
    //console.log(result);
    //console.log("**********************");
    //console.log(`VC verification result: ${result.verified}`);
    
}


run();