
pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

template CookieProofMulti(NCATS, BITS_SUM) {
       
    signal input origin_id;    
    signal input nowYear;      
    signal input catMask;      
    signal input nonce_int;
    signal input nonce_input;


    signal output nonce_pub;
    signal output origin_pub;
    signal output nowYear_pub;
    signal output mask_pub;    
    signal output C;           
    signal output nullifier;   
    signal output predAny;     
    signal output predAge18;  

    
    signal input dobYear;            
    signal input interestsPacked;    
    signal input consentVer;         
    signal input salt_user;          

    
    component yDobBits = Num2Bits(16);  yDobBits.in <== dobYear;
    component yNowBits = Num2Bits(16);  yNowBits.in <== nowYear;

    component maskBits = Num2Bits(NCATS);   maskBits.in <== catMask;
    component intrBits = Num2Bits(NCATS);   intrBits.in <== interestsPacked;

    
    component Hc = Poseidon(4);
    Hc.inputs[0] <== dobYear;
    Hc.inputs[1] <== interestsPacked;
    Hc.inputs[2] <== consentVer;
    Hc.inputs[3] <== salt_user;
    C <== Hc.out;

    
    nonce_pub  <== nonce_input;
    origin_pub <== origin_id;
    nowYear_pub <== nowYear;
    mask_pub   <== catMask;

    
    signal dobPlus; dobPlus <== dobYear + 18;
    signal rhs;     rhs     <== nowYear + 1;

    component ltAge = LessThan(17);     
    ltAge.in[0] <== dobPlus;
    ltAge.in[1] <== rhs;
    predAge18 <== ltAge.out;

    
    signal andBits[NCATS];
    for (var i = 0; i < NCATS; i++) {
        andBits[i] <== maskBits.out[i] * intrBits.out[i];
    }

    
    signal running[NCATS + 1];
    running[0] <== 0;
    for (var j = 0; j < NCATS; j++) {
        running[j + 1] <== running[j] + andBits[j];
    }

    
    component sumBits = Num2Bits(BITS_SUM);
    sumBits.in <== running[NCATS];

    component ltAny = LessThan(BITS_SUM);
    ltAny.in[0] <== 0;                 
    ltAny.in[1] <== running[NCATS];
    predAny <== ltAny.out;

    
    component Hn = Poseidon(5);
    Hn.inputs[0] <== 12345;  
    Hn.inputs[1] <== C;
    Hn.inputs[2] <== nonce_int;
    Hn.inputs[3] <== origin_id;
    Hn.inputs[4] <== catMask;
    nullifier <== Hn.out;
}

component main = CookieProofMulti(16, 5);
