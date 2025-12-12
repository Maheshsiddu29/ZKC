pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

template CookieProofMulti(NCATS, BITS_SUM) {
    // -----------------------------
    // Public-ish inputs
    // -----------------------------
    signal input origin_id;    
    signal input nowYear;      
    signal input catMask;      
    signal input nonce_int;
    signal input nonce_input;

    // Existing private profile inputs
    signal input dobYear;            
    signal input interestsPacked;    
    signal input consentVer;         
    signal input salt_user;          

    // New high-level interest segments (booleans)
    signal input int_home_kitchen;
    signal input int_personal_care;
    signal input int_beauty;
    signal input int_fitness;
    signal input int_gadgets;

    // New intent / recency segments (booleans)
    signal input hi_intent_recent;
    signal input cart_abandoner;
    signal input recent_buyer;

    // -----------------------------
    // Public outputs (publicSignals[])
    // index mapping must match backend IDX
    // -----------------------------
    signal output nonce_pub;        // 0
    signal output origin_pub;       // 1
    signal output nowYear_pub;      // 2
    signal output mask_pub;         // 3
    signal output C;                // 4
    signal output nullifier;        // 5
    signal output predAny;          // 6
    signal output predAge18;        // 7

    signal output predAge25;        // 8
    signal output predAge35;        // 9

    signal output intHomeKitchen;   // 10
    signal output intPersonalCare;  // 11
    signal output intBeauty;        // 12
    signal output intFitness;       // 13
    signal output intGadgets;       // 14

    signal output hiIntentRecent;   // 15
    signal output cartAbandonerOut; // 16
    signal output recentBuyerOut;   // 17

    // -----------------------------
    // Range checks / bit decompositions
    // -----------------------------
    component yDobBits = Num2Bits(16);  yDobBits.in <== dobYear;
    component yNowBits = Num2Bits(16);  yNowBits.in <== nowYear;

    component maskBits = Num2Bits(NCATS);   maskBits.in <== catMask;
    component intrBits = Num2Bits(NCATS);   intrBits.in <== interestsPacked;

    // -----------------------------
    // Enforce new inputs are booleans: x ∈ {0,1}
    // x * (x - 1) === 0
    // -----------------------------
    int_home_kitchen  * (int_home_kitchen  - 1) === 0;
    int_personal_care * (int_personal_care - 1) === 0;
    int_beauty        * (int_beauty        - 1) === 0;
    int_fitness       * (int_fitness       - 1) === 0;
    int_gadgets       * (int_gadgets       - 1) === 0;

    hi_intent_recent  * (hi_intent_recent  - 1) === 0;
    cart_abandoner    * (cart_abandoner    - 1) === 0;
    recent_buyer      * (recent_buyer      - 1) === 0;

    // -----------------------------
    // Commitment to local profile (unchanged)
    // -----------------------------
    component Hc = Poseidon(4);
    Hc.inputs[0] <== dobYear;
    Hc.inputs[1] <== interestsPacked;
    Hc.inputs[2] <== consentVer;
    Hc.inputs[3] <== salt_user;
    C <== Hc.out;

    // -----------------------------
    // Public mirrors of basic inputs
    // -----------------------------
    nonce_pub   <== nonce_input;
    origin_pub  <== origin_id;
    nowYear_pub <== nowYear;
    mask_pub    <== catMask;

    // -----------------------------
    // Age predicates: >=18, >=25, >=35
    // Condition: dobYear + threshold < nowYear + 1
    // -----------------------------
    signal dobPlus18; dobPlus18 <== dobYear + 18;
    signal dobPlus25; dobPlus25 <== dobYear + 25;
    signal dobPlus35; dobPlus35 <== dobYear + 35;

    signal rhs;       rhs       <== nowYear + 1;

    // >= 18
    component ltAge18 = LessThan(17);
    ltAge18.in[0] <== dobPlus18;
    ltAge18.in[1] <== rhs;
    predAge18 <== ltAge18.out;

    // >= 25
    component ltAge25 = LessThan(17);
    ltAge25.in[0] <== dobPlus25;
    ltAge25.in[1] <== rhs;
    predAge25 <== ltAge25.out;

    // >= 35
    component ltAge35 = LessThan(17);
    ltAge35.in[0] <== dobPlus35;
    ltAge35.in[1] <== rhs;
    predAge35 <== ltAge35.out;

    // -----------------------------
    // Legacy "any" interest predicate from fine-grained categories
    // (same logic you had before)
    // -----------------------------
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

    // -----------------------------
    // Expose high-level interest / intent bits as outputs
    // -----------------------------
    intHomeKitchen    <== int_home_kitchen;
    intPersonalCare   <== int_personal_care;
    intBeauty         <== int_beauty;
    intFitness        <== int_fitness;
    intGadgets        <== int_gadgets;

    hiIntentRecent    <== hi_intent_recent;
    cartAbandonerOut  <== cart_abandoner;
    recentBuyerOut    <== recent_buyer;

    // -----------------------------
    // Nullifier (unchanged)
    // -----------------------------
    component Hn = Poseidon(5);
    Hn.inputs[0] <== 12345;  
    Hn.inputs[1] <== C;
    Hn.inputs[2] <== nonce_int;
    Hn.inputs[3] <== origin_id;
    Hn.inputs[4] <== catMask;
    nullifier <== Hn.out;
}

component main = CookieProofMulti(16, 5);
