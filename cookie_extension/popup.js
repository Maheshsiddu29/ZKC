console.log("Popup JS loaded");

const BASE = "http://127.0.0.1:4000";

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const yobInput = document.getElementById("yobInput");
const techBox = document.getElementById("techBox");
const gamerBox = document.getElementById("gamerBox");
const zkBtn = document.getElementById("zkBtn");
const adBox = document.getElementById("adBox");
const advLink = document.getElementById("advLink");
const respBox = document.getElementById("responseBox");

function logResponse(obj) {
  respBox.textContent = JSON.stringify(obj, null, 2);
}

/* ----------------------------------------
   SEARCH BUTTON
---------------------------------------- */
searchBtn.addEventListener("click", async () => {
  try {
    respBox.textContent = "Searching...";

    let query = searchInput.value;
    let r = await fetch(`${BASE}/ads?q=${encodeURIComponent(query)}`);
    let data = await r.json();

    logResponse(data);

    if (data.ad && data.ad.imageUrl) {
      adBox.innerHTML = `<img src="${BASE}${data.ad.imageUrl}" width="200"/>`;
      advLink.href = data.ad.clickUrl;
    }
  } catch (err) {
    respBox.textContent = "Error: " + err;
  }
});

/* ----------------------------------------
   ZK SETUP BUTTON (FIXED)
---------------------------------------- */
zkBtn.addEventListener("click", async () => {
  try {
    respBox.textContent = "Requesting ZK challenge...";

    const yob = parseInt(yobInput.value);
    const tech = techBox.checked ? 1 : 0;
    const gamer = gamerBox.checked ? 1 : 0;

    // Bitmask → tech = bit 0, gamer = bit 1
    const mask = tech | (gamer << 1);

    // STEP 1: GET CHALLENGE
    const challengeRes = await fetch(
      `${BASE}/zkp/challenge?host=localhost&mask=${mask}`
    );

    const challengeData = await challengeRes.json();
    logResponse(challengeData);

    if (!challengeData.ok) {
      respBox.textContent = "Challenge failed: " + (challengeData.error || "");
      return;
    }

    // ✨ STOP HERE — next step is proof generation
    // Later: use challengeData.nonce, origin_id, nowYear to create proof
    // Then POST proof to /zkp/verify

    adBox.textContent = "Challenge received. Next: generate proof.";

  } catch (err) {
    respBox.textContent = "Error: " + err;
  }
});
