# Requirements of E-voting system
This electronic voting system is focused on citizen participation. Following are
the various requirement for electron voting. These requirements where gathered
after various discussion with experts who are currently working on e-voting system.

1. The authentication of a citizen based on citizen id (authentication).
2. The verication of the authorized citizen based on age, location. The
attribute responsible for verication can be changed later as future en-
hancement (Eligibility/ Authorization).
3. Anonymous voting should be present or secure voting (voting privacy or
Coercion resistant).
4. Verication of the result by anyone (universally veriable).
5. Verication of the result by the voter to know if that particular vote is
counted (individually veriable).
6. A voter should not be able to vote multiple times (unique voting).

# Problems associated with digital voting
1. Authentication and eligibility of a voter to vote.
2. Verify the voter with voter secrecy.
3. Software manipulation or result manipulation.
4. Verication of vote to avoid undermining trust.
5. Voting should be coercion resistant.
6. Scaling up fraud or bugs to manipulate the results.
7. Process is difficult to understand.

Note - eVotingnode is forked and tweaked to the user requirement from https://gitlab.com/blockchainlabdrenthe/nodeSSA.

# How to build and setup the Application

1. Extrace the file or clone this repository.
2. Perform npm install so that all npm packages gets installed. Do this inside the folder ./eVotingnode
3. Got to the folder called milestone2. (eVotingnode/code/milestone2/)
4. Perform npm install again
5. Since I am using IOTA Identity WASM bindings
6. ```npm run build:nodejs``` 
