# Requirements of E-voting system
This electronic voting system is focused on citizen participation. Following are
the various requirement for electron voting. These requirements where gathered
after various discussion with experts who are currently working on e-voting system.

1. The authentication of a citizen based on citizen id (authentication).
2. The verification of the authorized citizen based on age, location. The
attribute responsible for verication can be changed later as future en-
hancement (Eligibility/ Authorization).
3. Anonymous voting should be present or secure voting (voting privacy or
Coercion resistant).
4. Verification of the result by anyone (universally veriable).
5. Verification of the result by the voter to know if that particular vote is
counted (individually veriable).
6. A voter should not be able to vote multiple times (unique voting).

# Problems associated with digital voting
1. Authentication and eligibility of a voter to vote.
2. Verify the voter with voter secrecy.
3. Software manipulation or result manipulation.
4. Verification of vote to avoid undermining trust.
5. Voting should be coercion resistant.
6. Scaling up fraud or bugs to manipulate the results.
7. Process is difficult to understand.

Note - eVotingnode is forked and tweaked to the user requirement from https://gitlab.com/blockchainlabdrenthe/nodeSSA.

# How to build and setup the Application

1. Extrace the file or clone this repository.
2. Perform ```npm install``` so that all npm packages gets installed. Do this inside the folder ./eVotingnode
3. Got to the folder called milestone2. (eVotingnode/code/milestone2/auth-verif/)
4. Perform ```npm install``` again
5. Since I am using IOTA Identity WASM bindings
6. Perform ```npm run build:nodejs```

The above steps will build and install all dependencies that are required for the application.

# How to run the application

1. Create two node terminal.
2. In one of the terminal move to the directory in code/milestone2/auth-verif/authenticate/ .
3. To create a new decentralized id and verifiable credentials for the citizen, we have to run ```node unique_id.js```.
4. After which the verifiable credentials and decentralized id will be created and stored in ```citizen_verifiable_credentials.json```.
5. Now to autheticate whether the credentials are valid we have to execute ```node verify_id```.
6. This scipt will check if the created credentials are valid.
7. In the other terminal move to the directory in code/ .
8. Now to start the E-voting event we have to run organiser.js - ```node organiser.js``` .
9. Now for an citizen to participate in the event we have to run attendee.js - ```node attendee.js``` .
10. During the run time of the above script, the citizen can choose the corresponding vote.
11. The above process is repeated for the number of voters.
12. Once the voting time period is over, we have to run eventclose.js - ```node eventclose.js``` .
13. The script will allow to check live voting ids, and closed the voting event.
14. After closing the event, if we run eventclose.js again then vote counting option will be visible. Chossing it will start the process of couting and displays the results.
15. To perform individually verifiability property of this application. We have to run generateQR.js - ```node generateQR.js``` .
16. After that it will genrate a QRcode which can be used by the script verifier.js to verify if that person has voted by running verifier.js - ```node verifier.js``` . 
