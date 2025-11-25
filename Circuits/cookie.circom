
pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";


template CookieProof() {
    
    signal input nonce;         
    signal input origin_id;    
    signal input nowYear;      
    signal output nonce_pub;
    signal output origin_pub;
    signal output nowYear_pub;
    signal output C;           
    signal output nullifier;    
    signal output predTech;    
    signal output predAge18;  

   
    signal input dobYear;       
    signal input interestTech;  
    signal input consentVer;    
    signal input salt_user;     

   
    interestTech * (interestTech - 1) === 0;


    component yDobBits = Num2Bits(16);
    yDobBits.in <== dobYear;

    component yNowBits = Num2Bits(16);
    yNowBits.in <== nowYear;

    
    component Hc = Poseidon(4);
    Hc.inputs[0] <== dobYear;
    Hc.inputs[1] <== interestTech;
    Hc.inputs[2] <== consentVer;
    Hc.inputs[3] <== salt_user;
    C <== Hc.out;

   
    nonce_pub  <== nonce;
    origin_pub <== origin_id;
    nowYear_pub <== nowYear;

   
    predTech <== interestTech;

   
signal dobPlus;
signal rhs;

dobPlus <== dobYear + 18;
rhs     <== nowYear + 1;


    component lt = LessThan(17);
    lt.in[0] <== dobPlus;
    lt.in[1] <== rhs;
    predAge18 <== lt.out;

    
    
    component Hn = Poseidon(4);
    Hn.inputs[0] <== 12345;   
    Hn.inputs[1] <== C;
    Hn.inputs[2] <== nonce;
    Hn.inputs[3] <== origin_id;
    nullifier <== Hn.out;
}

component main = CookieProof();
