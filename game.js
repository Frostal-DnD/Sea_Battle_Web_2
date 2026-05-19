// ═══════════════════════════════════════════════════════════
//  SEA BATTLE — game.js  (v2 — portare completă din C++ v2)
//
//  Schimbări față de v1:
//  1. Hit / Kill → jucătorul primește tur bonus (la fel AI)
//  2. Kill marchează automat celulele adiacente navei cu '-'
//     și toate celulele navei devin 'k' (killID logic din C++)
// ═══════════════════════════════════════════════════════════

const COLS     = 'ABCDEFGHIJ'.split('');
const FLEET_DEF = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];

// ── State ────────────────────────────────────────────────
let P1, P2, idP1, idP2;
let liveOne, liveTwo;
let playerTurn;           // true = player's turn
let currentFleet, firstCell, orient;
let fleetUsed;

// AI hunt-and-destroy (din C++)
let aiTarget;             // 0=random 1=search 2=destroy
let aiQueue;
let aiDir;
let aiXmin, aiXmax, aiYmin, aiYmax;
const DX = [-1, 1, 0, 0];
const DY = [0,  0, -1, 1];

// ── Init ─────────────────────────────────────────────────
function initMatrix() {
  P1 = []; P2 = []; idP1 = []; idP2 = [];
  for (let i = 0; i < 12; i++) {
    P1[i]=[]; P2[i]=[]; idP1[i]=[]; idP2[i]=[];
    for (let j = 0; j < 12; j++) {
      P1[i][j] = { vis:'.', hidden:'.', col:0 };
      P2[i][j] = { vis:'.', hidden:'.', col:0 };
      idP1[i][j] = 0;
      idP2[i][j] = 0;
    }
  }
}

function resetFleet() {
  currentFleet = [];
  fleetUsed = { 1:0, 2:0, 3:0, 4:0 };
  firstCell = null;
  orient = 'h';
}

// ── Fleet limits ─────────────────────────────────────────
const FLEET_MAX = { 1:4, 2:3, 3:2, 4:1 };

function nextShipLen() {
  for (const l of [4,3,2,1])
    if (fleetUsed[l] < FLEET_MAX[l]) return l;
  return 0;
}

function allPlaced() {
  return [1,2,3,4].every(l => fleetUsed[l] === FLEET_MAX[l]);
}

// ── Place ship (collision layer identic cu C++) ───────────
function tryPlace(mat, idm, r, c, l, o, shipId) {
  if (o === 'v') {
    if (r + l - 1 > 10) return false;
    if (mat[r][c].col === '#') return false;
    if (mat[r+l-1][c].col === '#') return false;
    for (let i=0;i<l;i++) { mat[r+i][c].hidden='*'; idm[r+i][c]=shipId; }
    for (let i=-1;i<=l;i++) for (let dj=-1;dj<=1;dj++) {
      const nr=r+i, nc=c+dj;
      if (nr>=0&&nr<12&&nc>=0&&nc<12) mat[nr][nc].col='#';
    }
  } else {
    if (c + l - 1 > 10) return false;
    if (mat[r][c].col === '#') return false;
    if (mat[r][c+l-1].col === '#') return false;
    for (let i=0;i<l;i++) { mat[r][c+i].hidden='*'; idm[r][c+i]=shipId; }
    for (let di=-1;di<=1;di++) for (let i=-1;i<=l;i++) {
      const nr=r+di, nc=c+i;
      if (nr>=0&&nr<12&&nc>=0&&nc<12) mat[nr][nc].col='#';
    }
  }
  return true;
}

// ── Placement UI ─────────────────────────────────────────
function setOrient(o) {
  orient = o;
  document.getElementById('btn-horiz').classList.toggle('active', o==='h');
  document.getElementById('btn-vert').classList.toggle('active',  o==='v');
  firstCell = null;
  renderPlaceGrid();
}

function placeClick(r, c) {
  const l = nextShipLen();
  if (!l) return;
  if (!firstCell) {
    firstCell = {r, c};
    setPlaceMsg(`Celulă: ${r}${COLS[c-1]}. Click din nou pentru a confirma.`);
    renderPlaceGrid();
    return;
  }
  const ok = tryPlace(P1, idP1, firstCell.r, firstCell.c, l, orient, currentFleet.length+1);
  if (ok) {
    fleetUsed[l]++;
    currentFleet.push({l, r:firstCell.r, c:firstCell.c, o:orient});
    setPlaceMsg(`Navă de lungime ${l} plasată! ${nextShipLen()?'Continuă.':'Flotă completă!'}`);
  } else {
    setPlaceMsg('Nu se poate plasa acolo. Încearcă altă celulă.');
  }
  firstCell = null;
  renderPlaceGrid();
  renderFleetList();
  document.getElementById('start-btn').disabled = !allPlaced();
}

function placeHover(r, c, enter) {
  document.querySelectorAll('#place-grid .cell[data-r]')
    .forEach(el => el.classList.remove('place-hover','place-hover-invalid'));
  if (!enter || !firstCell) return;
  const l = nextShipLen(); if (!l) return;
  let valid = true;
  if (orient==='v') {
    if (firstCell.r+l-1>10||P1[firstCell.r][firstCell.c].col==='#'||P1[firstCell.r+l-1][firstCell.c].col==='#') valid=false;
  } else {
    if (firstCell.c+l-1>10||P1[firstCell.r][firstCell.c].col==='#'||P1[firstCell.r][firstCell.c+l-1].col==='#') valid=false;
  }
  const cls = valid ? 'place-hover' : 'place-hover-invalid';
  for (let i=0;i<l;i++) {
    const pr = orient==='v' ? firstCell.r+i : firstCell.r;
    const pc = orient==='h' ? firstCell.c+i : firstCell.c;
    const el = document.querySelector(`#place-grid .cell[data-r="${pr}"][data-c="${pc}"]`);
    if (el) el.classList.add(cls);
  }
}

function setPlaceMsg(msg) {
  document.getElementById('place-msg').textContent = msg;
}

function randomFleet() {
  initMatrix(); resetFleet();
  for (let idx=0; idx<FLEET_DEF.length; idx++) {
    const l = FLEET_DEF[idx];
    let placed=false, tries=0;
    while (!placed && tries<2000) {
      tries++;
      const r=rnd(1,10), c=rnd(1,10), o=Math.random()<.5?'v':'h';
      placed = tryPlace(P1,idP1,r,c,l,o,idx+1);
      if (placed) { fleetUsed[l]++; currentFleet.push({l,r,c,o}); }
    }
  }
  renderPlaceGrid(); renderFleetList();
  document.getElementById('start-btn').disabled = false;
  setPlaceMsg('Flotă plasată aleatoriu! Apasă LANSEAZĂ ATACUL.');
}

function clearFleet() {
  initMatrix(); resetFleet();
  renderPlaceGrid(); renderFleetList();
  document.getElementById('start-btn').disabled = true;
  setPlaceMsg('Selectează o celulă pentru a plasa nava.');
}

// ── Render helpers ────────────────────────────────────────
function buildColLabels(id) {
  document.getElementById(id).innerHTML =
    '<div></div>' + COLS.map(c=>`<div class="col-lbl">${c}</div>`).join('');
}

function buildBoard(gridId, mat, isEnemy, showShips, onClickFn) {
  const el = document.getElementById(gridId);
  el.innerHTML = '';
  for (let i=1;i<=10;i++) {
    el.innerHTML += `<div class="row-lbl">${i}</div>`;
    for (let j=1;j<=10;j++) {
      const cell = mat[i][j];
      let cls='cell', txt='';
      if (isEnemy) {
        if      (cell.vis==='h') { cls+=' hit';  txt='●'; }
        else if (cell.vis==='k') { cls+=' kill'; txt='✕'; }
        else if (cell.vis==='-') { cls+=' miss'; txt='·'; }
      } else {
        if (showShips && cell.hidden==='*') cls+=' ship';
        if      (cell.vis==='h') { cls+=' hit';  txt='●'; }
        else if (cell.vis==='k') { cls+=' kill'; txt='✕'; }
        else if (cell.vis==='-') { cls+=' miss'; txt='·'; }
      }
      const clickAttr = onClickFn ? `onclick="${onClickFn}(${i},${j})"` : '';
      el.innerHTML += `<div class="${cls}" data-r="${i}" data-c="${j}" ${clickAttr}>${txt}</div>`;
    }
  }
}

function renderPlaceGrid() {
  const el = document.getElementById('place-grid');
  el.innerHTML = '';
  for (let i=1;i<=10;i++) {
    el.innerHTML += `<div class="row-lbl">${i}</div>`;
    for (let j=1;j<=10;j++) {
      const cell = P1[i][j];
      let cls = 'cell';
      if (cell.hidden==='*') cls+=' ship';
      else if (firstCell && firstCell.r===i && firstCell.c===j) cls+=' place-hover';
      else cls+=' enemy-clickable';
      el.innerHTML += `<div class="${cls}" data-r="${i}" data-c="${j}"
        onclick="placeClick(${i},${j})"
        onmouseenter="placeHover(${i},${j},true)"
        onmouseleave="placeHover(${i},${j},false)"></div>`;
    }
  }
}

function renderFleetList() {
  const defs = [{l:4,max:1},{l:3,max:2},{l:2,max:3},{l:1,max:4}];
  let html='';
  defs.forEach(d => {
    for (let k=0;k<d.max;k++) {
      const done = k < fleetUsed[d.l];
      html += `<div class="fleet-item${done?' done':''}">
        <span class="ship-repr">${'■'.repeat(d.l)}</span>
        <span>${done?'✓':'('+d.l+')'}</span>
      </div>`;
    }
  });
  document.getElementById('fleet-list').innerHTML = html;
}

function renderBoards() {
  buildBoard('my-grid',    P1, false, true,  null);
  buildBoard('enemy-grid', P2, true,  false, 'playerAttack');
}

// ── Start / End ───────────────────────────────────────────
function startGame() {
  // Place AI fleet
  for (let idx=0; idx<FLEET_DEF.length; idx++) {
    const l = FLEET_DEF[idx];
    let placed=false, tries=0;
    while (!placed && tries<2000) {
      tries++;
      const r=rnd(1,10), c=rnd(1,10), o=Math.random()<.5?'v':'h';
      placed = tryPlace(P2,idP2,r,c,l,o,idx+1);
    }
  }
  liveOne=0; liveTwo=0;
  for (let i=1;i<=10;i++) for (let j=1;j<=10;j++) {
    if (P1[i][j].hidden==='*') liveOne++;
    if (P2[i][j].hidden==='*') liveTwo++;
  }
  playerTurn=true;
  aiTarget=0; aiQueue=0; aiDir=0;

  showScreen('game');
  buildColLabels('my-col'); buildColLabels('enemy-col');
  renderBoards();
  updateHUD(false);
  addLog('Jocul a început. Tu atacați primul.','info');
}

function endGame(winner) {
  showScreen('end');
  if (winner===1) {
    document.getElementById('end-icon').textContent  = '🎖️';
    document.getElementById('end-title').textContent = 'VICTORIE!';
    document.getElementById('end-title').style.color = 'var(--green)';
    document.getElementById('end-sub').textContent   = 'Flota inamică a fost complet scufundată.';
  } else {
    document.getElementById('end-icon').textContent  = '💀';
    document.getElementById('end-title').textContent = 'ÎNFRÂNGERE';
    document.getElementById('end-title').style.color = 'var(--red)';
    document.getElementById('end-sub').textContent   = 'Flota ta a fost distrusă de AI.';
  }
}

function resetGame() {
  initMatrix(); resetFleet();
  showScreen('place');
  renderPlaceGrid(); renderFleetList();
  document.getElementById('start-btn').disabled = true;
  document.getElementById('lm-player').textContent = '—';
  document.getElementById('lm-ai').textContent = '—';
  document.getElementById('log').innerHTML = '';
  clearBonusBadge();
  setPlaceMsg('Selectează o celulă pentru a plasa nava.');
}

// ── Kill: marchează celulele adiacente cu '-' (din C++) ───
// Identic cu blocul killID din C++:
// for a in [0,1,2] for b in [0,1,2] => i+a-1, j+b-1
function markKillZone(mat, idm, killedId) {
  // Mai întâi găsim toate celulele navei scufundate
  for (let i=1;i<=10;i++) for (let j=1;j<=10;j++) {
    if (idm[i][j] === killedId) {
      // marchează zona adiacentă 3x3
      for (let a=0;a<3;a++) for (let b=0;b<3;b++) {
        const ni=i+a-1, nj=j+b-1;
        if (ni>=1&&ni<=10&&nj>=1&&nj<=10) {
          if (mat[ni][nj].vis==='.') mat[ni][nj].vis='-';
        }
      }
      // marcăm celulele 'h' ale navei cu 'k'
      for (let a=0;a<3;a++) for (let b=0;b<3;b++) {
        const ni=i+a, nj=j+b;
        if (ni>=1&&ni<=10&&nj>=1&&nj<=10) {
          if (mat[ni][nj].vis==='h') mat[ni][nj].vis='k';
        }
      }
    }
  }
}

// ── Core attack (verificare hit/kill) ─────────────────────
// Returnează: { hit, status:'hit'|'kill'|'miss', killedId }
function doAttack(mat, idm, r, c) {
  if (mat[r][c].hidden !== '*') {
    mat[r][c].vis = '-';
    return { hit:false, status:'miss', killedId:null };
  }
  const shipId = idm[r][c];
  idm[r][c] = -idm[r][c];   // marchează celula lovită (negativă)

  // câte celule cu același id (pozitiv) mai rămân
  let remaining = 0;
  for (let i=1;i<=10;i++) for (let j=1;j<=10;j++)
    if (idm[i][j] === shipId) remaining++;

  if (remaining > 0) {
    mat[r][c].vis = 'h';
    return { hit:true, status:'hit', killedId:null };
  } else {
    mat[r][c].vis = 'k';
    // toate celulele navei → 'k'
    for (let i=1;i<=10;i++) for (let j=1;j<=10;j++)
      if (idm[i][j] === -shipId) mat[i][j].vis='k';
    // marchează zona din jur cu '-' (killID logic din C++)
    markKillZone(mat, idm, -shipId);
    return { hit:true, status:'kill', killedId:-shipId };
  }
}

// ── Player attack ─────────────────────────────────────────
function playerAttack(r, c) {
  if (!playerTurn) return;
  if (P2[r][c].vis !== '.') return;

  const result = doAttack(P2, idP2, r, c);
  if (result.hit) liveTwo--;

  const coord = `${r}${COLS[c-1]}`;
  document.getElementById('lm-player').textContent = coord+' '+statusIcon(result.status);

  if (result.status==='hit') {
    addLog(`Tu → ${coord}: HIT 🔥`, 'hit');
  } else if (result.status==='kill') {
    addLog(`Tu → ${coord}: SCUFUNDAT! ☠️`, 'kill');
  } else {
    addLog(`Tu → ${coord}: ratat`, 'miss');
  }

  document.getElementById('lives-two').textContent = liveTwo;
  renderBoards();
  if (liveTwo <= 0) { endGame(1); return; }

  // ── BONUS TURN on hit or kill (din C++) ─────────────────
  if (result.status === 'hit' || result.status === 'kill') {
    showBonusBadge('🎯 Lovitură! Trage din nou!');
    addLog('Bonus: mai tragi o dată!', 'bonus');
    // playerTurn rămâne true → jucătorul trage din nou
    updateHUD(true);
    return;
  }

  // Miss → trece la AI
  clearBonusBadge();
  playerTurn = false;
  updateHUD(false);
  setTimeout(aiTurn, 700);
}

// ── AI turn ───────────────────────────────────────────────
function aiTurn() {
  let r, c, moved=false;

  if (aiTarget===2) {
    const res=destroyMode();
    if (res) { r=res.r; c=res.c; moved=true; }
    else { aiTarget=0; aiQueue=0; aiDir=0; }
  }
  if (!moved && aiTarget===1) {
    const res=searchMode();
    if (res) { r=res.r; c=res.c; moved=true; }
    else { aiTarget=0; aiQueue=0; aiDir=0; }
  }
  if (!moved) {
    do { r=rnd(1,10); c=rnd(1,10); }
    while (alreadyShot(P1,r,c));
  }

  const result = doAttack(P1, idP1, r, c);
  if (result.hit) liveOne--;

  const coord = `${r}${COLS[c-1]}`;
  document.getElementById('lm-ai').textContent = coord+' '+statusIcon(result.status);

  if (result.status==='hit') {
    addLog(`AI → ${coord}: HIT 🔥`, 'hit');
    if (aiTarget===0) {
      aiTarget=1; aiXmin=r; aiYmin=c; aiXmax=r; aiYmax=c; aiQueue=0;
    } else if (aiTarget===1) {
      aiTarget=2; updateDestroyBounds(r,c);
    } else {
      updateDestroyBounds(r,c);
    }
  } else if (result.status==='kill') {
    addLog(`AI → ${coord}: SCUFUNDAT! ☠️`, 'kill');
    aiTarget=0; aiQueue=0; aiDir=0;
  } else {
    addLog(`AI → ${coord}: ratat`, 'miss');
    if (aiTarget===1) aiQueue++;
    else if (aiTarget===2) aiDir=1-aiDir;
  }

  document.getElementById('lives-one').textContent = liveOne;
  renderBoards();
  if (liveOne <= 0) { endGame(2); return; }

  // ── BONUS TURN for AI on hit or kill (din C++) ──────────
  if (result.status==='hit' || result.status==='kill') {
    addLog('AI trage din nou!', 'bonus');
    setTimeout(aiTurn, 900);   // AI gets another turn
    return;
  }

  // Miss → înapoi la jucător
  playerTurn = true;
  clearBonusBadge();
  updateHUD(false);
}

// ── AI modes (search / destroy) ───────────────────────────
function searchMode() {
  for (let q=aiQueue; q<4; q++) {
    const nr=aiXmin+DX[q], nc=aiYmin+DY[q];
    if (nr<1||nr>10||nc<1||nc>10) continue;
    if (alreadyShot(P1,nr,nc)) continue;
    aiQueue=q;
    return {r:nr, c:nc};
  }
  return null;
}

function destroyMode() {
  const sameCol = aiXmax===aiXmin;
  const calc=(dir)=>{
    if (sameCol) return {r:aiXmax, c:dir===0?aiYmax+1:aiYmin-1};
    else         return {r:dir===0?aiXmax+1:aiXmin-1, c:aiYmax};
  };
  let pos=calc(aiDir);
  if (outOfBounds(pos.r,pos.c)||alreadyShot(P1,pos.r,pos.c)) {
    aiDir=1-aiDir; pos=calc(aiDir);
  }
  if (outOfBounds(pos.r,pos.c)||alreadyShot(P1,pos.r,pos.c)) return null;
  return pos;
}

function updateDestroyBounds(r,c) {
  if (r>aiXmax) aiXmax=r; if (r<aiXmin) aiXmin=r;
  if (c>aiYmax) aiYmax=c; if (c<aiYmin) aiYmin=c;
}

function outOfBounds(r,c) { return r<1||r>10||c<1||c>10; }
function alreadyShot(mat,r,c) {
  const v=mat[r][c].vis;
  return v==='h'||v==='k'||v==='-';
}

// ── HUD ───────────────────────────────────────────────────
function updateHUD(bonusTurn) {
  const ind = document.getElementById('turn-ind');
  if (bonusTurn) {
    ind.textContent = 'TUR BONUS! 🎯';
    ind.className = 'turn-indicator';
  } else if (playerTurn) {
    ind.textContent = 'RÂNDUL TĂU';
    ind.className = 'turn-indicator';
  } else {
    ind.textContent = 'AI ATACĂ...';
    ind.className = 'turn-indicator ai-turn';
  }
  document.getElementById('enemy-grid').className =
    'board-grid' + (playerTurn ? ' clickable-board' : '');
}

function showBonusBadge(msg) {
  let b = document.getElementById('bonus-badge');
  if (!b) {
    b = document.createElement('div');
    b.id = 'bonus-badge';
    b.className = 'bonus-badge';
    const cp = document.querySelector('.center-panel');
    const ind = document.getElementById('turn-ind');
    cp.insertBefore(b, ind.nextSibling);
  }
  b.textContent = msg;
}

function clearBonusBadge() {
  const b = document.getElementById('bonus-badge');
  if (b) b.remove();
}

function addLog(msg, type) {
  const log = document.getElementById('log');
  const d = document.createElement('div');
  d.className = 'log-entry' + (type ? ` log-${type}` : '');
  d.textContent = msg;
  log.prepend(d);
}

function statusIcon(s) {
  if (s==='hit')  return '●';
  if (s==='kill') return '✕';
  return '·';
}

// ── Screens ───────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
}

// ── Utils ─────────────────────────────────────────────────
function rnd(a,b) { return Math.floor(Math.random()*(b-a+1))+a; }

// ── Bootstrap ─────────────────────────────────────────────
(function init() {
  initMatrix();
  resetFleet();
  buildColLabels('place-col');
  renderPlaceGrid();
  renderFleetList();
})();
