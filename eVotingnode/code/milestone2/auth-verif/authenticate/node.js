// Copyright 2020-2021 IOTA Stiftung
// SPDX-License-Identifier: Apache-2.0

const { createIdentity } = require('./create_did');
const { manipulateIdentity } = require('./manipulate_did');
const { CLIENT_CONFIG } = require('./config');
const {decentralizedId} = require('./decentralized_id');

async function main() {
    //Check if an example is mentioned
    if(process.argv.length != 3) {
        throw 'Please provide one command line argument with the example name.';
    }

    //Take out the argument
    let argument = process.argv[2];
    switch(argument) {
        case 'create_did':
            return await createIdentity(CLIENT_CONFIG);
        case 'manipulate_did':
            return await manipulateIdentity(CLIENT_CONFIG);
        case 'decentralized_id':
            return await decentralizedId(CLIENT_CONFIG);
        default:
            throw 'Unknown example name';
    }
}

main().then((output) => {
    console.log("Ok >", output)
}).catch((error) => {
    console.log("Err >", error)
})
