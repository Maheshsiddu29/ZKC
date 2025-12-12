pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

template CookieProofMulti(NCATS, BITS_SUM) {
    // these are the public inpuits
    signal input origin_id;    
    signal input nowYear;      
    signal input catMask;      
    signal input nonce_int;
    signal input nonce_input;

    // these are the  private inputs, we wont share this with anyone
    signal input dobYear;            
    signal input interestsPacked;    
    signal input consentVer;         
    signal input salt_user;          

    // predicates
    signal input int_home_kitchen;
    signal input int_personal_care;
    signal input int_beauty;
    signal input int_fitness;
    signal input int_gadgets;

    // customer intent segment , like analysing his interests
    signal input hi_intent_recent;
    signal input cart_abandoner;
    signal input recent_buyer;

    //our circuit public outputs 

    signal output nonce_pub;        
    signal output origin_pub;      
    signal output nowYear_pub;      
    signal output mask_pub;         
    signal output C;                
    signal output nullifier;        
    signal output predAny;          
    signal output predAge18;        

    signal output predAge25;        
    signal output predAge35;        

    signal output intHomeKitchen;   
    signal output intPersonalCare;  
    signal output intBeauty;        
    signal output intFitness;       
    signal output intGadgets;      

    signal output hiIntentRecent;   
    signal output cartAbandonerOut; 
    signal output recentBuyerOut;   

    // age verification
    component yDobBits = Num2Bits(16);  yDobBits.in <== dobYear;
    component yNowBits = Num2Bits(16);  yNowBits.in <== nowYear;
    component maskBits = Num2Bits(NCATS);   maskBits.in <== catMask;
    component intrBits = Num2Bits(NCATS);   intrBits.in <== interestsPacked;

    int_home_kitchen  * (int_home_kitchen  - 1) === 0;
    int_personal_care * (int_personal_care - 1) === 0;
    int_beauty        * (int_beauty        - 1) === 0;
    int_fitness       * (int_fitness       - 1) === 0;
    int_gadgets       * (int_gadgets       - 1) === 0;

    hi_intent_recent  * (hi_intent_recent  - 1) === 0;
    cart_abandoner    * (cart_abandoner    - 1) === 0;
    recent_buyer      * (recent_buyer      - 1) === 0;

    // commitment calculation
    component Hc = Poseidon(4);
    Hc.inputs[0] <== dobYear;
    Hc.inputs[1] <== interestsPacked;
    Hc.inputs[2] <== consentVer;
    Hc.inputs[3] <== salt_user;
    C <== Hc.out;

    
    nonce_pub   <== nonce_input;
    origin_pub  <== origin_id;
    nowYear_pub <== nowYear;
    mask_pub    <== catMask;

    signal dobPlus18; dobPlus18 <== dobYear + 18;
    signal dobPlus25; dobPlus25 <== dobYear + 25;
    signal dobPlus35; dobPlus35 <== dobYear + 35;
    signal rhs;       rhs       <== nowYear + 1;

    //if age is greater than 18
    component ltAge18 = LessThan(17);
    ltAge18.in[0] <== dobPlus18;
    ltAge18.in[1] <== rhs;
    predAge18 <== ltAge18.out;

    // if age is greater than 25
    component ltAge25 = LessThan(17);
    ltAge25.in[0] <== dobPlus25;
    ltAge25.in[1] <== rhs;
    predAge25 <== ltAge25.out;

    // if age is greater than 35
    component ltAge35 = LessThan(17);
    ltAge35.in[0] <== dobPlus35;
    ltAge35.in[1] <== rhs;
    predAge35 <== ltAge35.out;


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

    // saving high level interests
    intHomeKitchen    <== int_home_kitchen;
    intPersonalCare   <== int_personal_care;
    intBeauty         <== int_beauty;
    intFitness        <== int_fitness;
    intGadgets        <== int_gadgets;

    hiIntentRecent    <== hi_intent_recent;
    cartAbandonerOut  <== cart_abandoner;
    recentBuyerOut    <== recent_buyer;

    
    component Hn = Poseidon(5);
    Hn.inputs[0] <== 12345;  
    Hn.inputs[1] <== C;
    Hn.inputs[2] <== nonce_int;
    Hn.inputs[3] <== origin_id;
    Hn.inputs[4] <== catMask;
    nullifier <== Hn.out;
}

component main = CookieProofMulti(16, 5);
