const { VerifiableCredential, checkCredential } = require('../node/identity_wasm')
const { createIdentity } = require('./create_did');
const { manipulateIdentity } = require('./manipulate_did');

async function decentralizedId(clientConfig) {

    // Creates new identities (See "create_did" and "manipulate_did" examples)
    const citizen_id = await createIdentity(clientConfig);
    const government_id = await manipulateIdentity(clientConfig);
    console.log("********************citizen_id*************************");
    console.log(citizen_id);
    console.log("************************issuer*************************");
    console.log(government_id);

    // Prepare a credential subject indicating the degree earned by citizen_id
    let credentialSubject = {
        id: citizen_id.doc.id.toString(),
        first_name: "John",
        last_name: "Smith",
        age:"20",
        postalcode: "9852",
        nationality: "The Netherlands",
        city: "Groningen",
        gender: "Male",
        bsn: "987452136"
    };

    // Create an unsigned `UniversityDegree` credential for citizen_id
    const unsignedVc = VerifiableCredential.extend({
        id: "http://example.edu/credentials/3732",
        type: "NationalIdentityCredentials",
        issuer: government_id.doc.id.toString(),
        credentialSubject,
    });

    // Sign the credential with the government_id's newKey
    const signedVc = government_id.doc.signCredential(unsignedVc, {
        method: government_id.doc.id.toString()+"#newKey",
        public: government_id.newKey.public,
        secret: government_id.newKey.secret,
    });

    // Check if the credential is verifiable.
    const result = await checkCredential(signedVc.toString(), clientConfig);
    console.log("*********************result**************");
    //console.log(result.credential.credentialSubject.age);
    console.log(result);
    console.log("**********************");
    console.log(`VC verification result: ${result.verified}`);

    return 0;
}

exports.decentralizedId = decentralizedId;
