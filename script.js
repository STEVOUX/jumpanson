/* Flappy Fart — main game
   Assumptions: you put these files inside /assets/:
   - assets/bharatgas.png
   - assets/player.png
   - assets/fart.png
   - assets/bg_lobby.mp3
   - assets/bg_game.mp3
   - assets/fart.mp3
*/

(() => {
  // ----- Canvas setup -----
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d', { alpha: true });

  function resizeCanvas() {
    // Keep a fixed virtual resolution for consistent physics; scale the canvas to fit responsively
    const maxWidth = Math.min(window.innerWidth - 40, 900);
    const aspect = 400/600; // width/height for good mobile feel
    const w = maxWidth;
    const h = Math.round(w / aspect);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    // Set internal pixel resolution for crisp rendering
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // ----- DOM elements -----
  const lobby = document.getElementById('lobby');
  const infoModal = document.getElementById('infoModal');
  const gameOver = document.getElementById('gameOver');
  const playBtn = document.getElementById('playBtn');
  const infoBtn = document.getElementById('infoBtn');
  const closeInfo = document.getElementById('closeInfo');
  const retryBtn = document.getElementById('retryBtn');
  const toLobbyBtn = document.getElementById('toLobbyBtn');
  const playerNameInput = document.getElementById('playerName');
  const topScoreEl = document.getElementById('top-score');
  const finalScoreEl = document.getElementById('finalScore');
  const bestScoreEl = document.getElementById('bestScore');

  // default name
  playerNameInput.value = localStorage.getItem('ff_name') || 'bharath anson';

  // ----- Assets -----
  const ASSET_PATH = 'assets/';
  const imgPlayer = new Image();
  imgPlayer.src = ASSET_PATH + 'player.png';

  const imgGas = new Image();
  imgGas.src = ASSET_PATH + 'bharatgas.png';

  const imgFart = new Image();
  imgFart.src = ASSET_PATH + 'fart.png';

  const sFart = new Audio(ASSET_PATH + 'fart.mp3');
  sFart.preload = 'auto';
  sFart.volume = 0.8;

  const bgLobby = new Audio(ASSET_PATH + 'bg_lobby.mp3');
  bgLobby.loop = true;
  bgLobby.volume = 0.45;

  const bgGame = new Audio(ASSET_PATH + 'bg_game.mp3');
  bgGame.loop = true;
  bgGame.volume = 0.5;

  // mobile autoplay: try to play lobby bg when user interacts
  function tryPlayLobbyMusic() {
    bgLobby.play().catch(()=>{});
    window.removeEventListener('pointerdown', tryPlayLobbyMusic);
  }
  window.addEventListener('pointerdown', tryPlayLobbyMusic);

  // ----- Game state -----
  let gameState = 'lobby'; // 'lobby' | 'playing' | 'over'
  let score = 0;
  let best = parseInt(localStorage.getItem('ff_best') || '0', 10);
  topScoreEl.textContent = `Top: ${best}`;

  // physics scaled to virtual canvas height
  const VIRTUAL_HEIGHT = 600; // used for physics constants
  function vh(x){ // convert dimension to current canvas pixel measure
    return x * (canvas.height / VIRTUAL_HEIGHT) / (window.devicePixelRatio || 1);
  }

  // Player object
  const player = {
    x: 80,
    y: 220,
    width: 56,
    height: 56,
    vel: 0,
    gravity: 0.55,
    lift: -10,
    rotation: 0
  };

  // Particles for fart
  const particles = [];

  // Obstacles (cylinders)
  const cylinders = [];
  let frames = 0;

  // Difficulty params (base)
  const base = {
    gap: 150,
    speed: 2.2,
    spawnRate: 90 // frames
  };

  // Difficulty ramp thresholds and multipliers
  function difficultyForScore(s) {
    // returns object with gap and speed
    let gap = base.gap;
    let speed = base.speed;
    let spawnRate = base.spawnRate;

    if (s >= 10) { gap = Math.max(110, gap - 15); speed += 0.5; spawnRate = 78; }
    if (s >= 25) { gap = Math.max(95, gap - 10); speed += 0.6; spawnRate = 72; }
    if (s >= 50) { gap = Math.max(85, gap - 10); speed += 0.75; spawnRate = 66; }
    if (s >= 75) { gap = Math.max(78, gap - 7); speed += 1.0; spawnRate = 60; }
    if (s >= 100){ gap = Math.max(68, gap - 10); speed += 1.4; spawnRate = 55; }
    return { gap, speed, spawnRate };
  }

  // ----- Controls -----
  function flap() {
    if (gameState === 'lobby') {
      startGame();
      return;
    }
    if (gameState !== 'playing') return;
    player.vel = player.lift;
    player.rotation = -0.6;
    playFart();
    spawnFartParticle();
  }

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      flap();
    }
    if (e.key === 'Enter' && gameState === 'lobby') {
      startGame();
    }
  });
  document.addEventListener('mousedown', () => flap());
  document.addEventListener('touchstart', (e) => { e.preventDefault(); flap(); }, { passive: false });

  function playFart() {
    try {
      sFart.currentTime = 0.03;
      sFart.play();
    } catch (err) {}
  }

  function spawnFartParticle() {
    particles.push({
      x: player.x - 10 + Math.random() * 10,
      y: player.y + player.height * 0.45 + (Math.random() * 10 - 5),
      vx: -1 - Math.random() * 0.8,
      vy: -0.2 + Math.random() * -0.6,
      alpha: 1,
      size: 14 + Math.random() * 12
    });
  }

  // ----- Game lifecycle -----
  function startGame() {
    // save name
    const nm = (playerNameInput.value || 'bharath anson').trim();
    playerNameInput.value = nm;
    localStorage.setItem('ff_name', nm);

    // reset
    gameState = 'playing';
    lobby.classList.add('hidden');
    infoModal.classList.add('hidden');
    gameOver.classList.add('hidden');

    score = 0;
    cylinders.length = 0;
    particles.length = 0;
    frames = 0;
    player.y = canvas.height / 3;
    player.vel = 0;
    player.rotation = 0;

    // audio
    bgLobby.pause();
    bgGame.currentTime = 0;
    bgGame.play().catch(()=>{});

    requestAnimationFrame(loop);
  }

  function endGame() {
    gameState = 'over';
    bgGame.pause();

    // highscore check
    if (score > best) {
      best = score;
      localStorage.setItem('ff_best', best);
    }
    topScoreEl.textContent = `Top: ${best}`;
    finalScoreEl.textContent = `Score: ${score}`;
    bestScoreEl.textContent = `Best: ${best}`;

    // show overlay
    gameOver.classList.remove('hidden');
  }

  retryBtn.addEventListener('click', () => {
    startGame();
  });
  toLobbyBtn.addEventListener('click', () => {
    gameState = 'lobby';
    gameOver.classList.add('hidden');
    lobby.classList.remove('hidden');
    bgGame.pause();
    bgLobby.currentTime = 0;
    bgLobby.play().catch(()=>{});
  });

  playBtn.addEventListener('click', startGame);
  infoBtn.addEventListener('click', () => {
    infoModal.classList.remove('hidden');
    lobby.classList.add('hidden');
  });
  closeInfo.addEventListener('click', () => {
    infoModal.classList.add('hidden');
    lobby.classList.remove('hidden');
  });

  // Attempt to play lobby music
  bgLobby.play().catch(()=>{});

  // ----- Obstacles spawn -----
  function spawnCylinders() {
    // spawn a top & bottom cylinder pair with gap
    const cfg = difficultyForScore(score);
    const gap = cfg.gap;
    const minTop = 50;
    const maxTop = canvas.height - gap - 80;
    const topH = Math.max(minTop, Math.random() * (maxTop - minTop) + minTop);

    const gasWidth = Math.round(Math.min(86, canvas.width * 0.14)); // keep pipe width reasonable
    const top = {
      x: canvas.width + 20,
      y: 0,
      width: gasWidth,
      height: topH,
      counted: false
    };
    const bottom = {
      x: canvas.width + 20,
      y: topH + gap,
      width: gasWidth,
      height: canvas.height - (topH + gap),
      counted: false
    };
    cylinders.push(top, bottom);
  }

  // ----- Collision -----
  function rectsOverlap(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  // ----- Main loop -----
  function loop() {
    if (gameState !== 'playing') return;

    frames++;

    // physics
    player.vel += player.gravity;
    player.y += player.vel;
    player.rotation = Math.max(-1.2, Math.min(1.6, player.rotation + 0.04)); // gentle tilt downwards over time

    // difficulty
    const cfg = difficultyForScore(score);
    const speed = cfg.speed;
    const spawnRate = cfg.spawnRate;

    // spawn
    if (frames % spawnRate === 0) spawnCylinders();

    // move cylinders
    for (let i = cylinders.length - 1; i >= 0; i--) {
      const c = cylinders[i];
      c.x -= speed;
      // count score when a top cylinder passes player
      if (!c.counted && c.x + c.width < player.x && c.y === 0) {
        c.counted = true;
        score++;
        // update top score display
        if (score > best) topScoreEl.textContent = `Top: ${score}`;
      }
      // remove offscreen
      if (c.x + c.width < -50) cylinders.splice(i, 1);
    }

    // update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.03;
      p.size *= 0.996;
      if (p.alpha <= 0.02) particles.splice(i, 1);
    }

    // collisions: check player vs cylinders
    const playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };
    // Also check world bounds
    if (player.y + player.height > canvas.height || player.y < -10) {
      // hit ground or top
      endGame();
      return;
    }
    for (const c of cylinders) {
      const cRect = { x: c.x, y: c.y, width: c.width, height: c.height };
      if (rectsOverlap(playerRect, cRect)) {
        endGame();
        return;
      }
    }

    // --- Render ---
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background (parallax sky)
    drawBackground();

    // Draw cylinders (bottom first)
    for (const c of cylinders) {
      drawGas(c);
    }

    // Draw particles behind (so they overlap player nicely)
    for (const p of particles) {
      ctx.globalAlpha = p.alpha;
      const size = p.size;
      ctx.drawImage(imgFart, p.x - size/2, p.y - size/2, size, size);
      ctx.globalAlpha = 1;
    }

    // Draw player (with rotation)
    ctx.save();
    ctx.translate(player.x + player.width/2, player.y + player.height/2);
    ctx.rotate(player.rotation);
    ctx.drawImage(imgPlayer, -player.width/2, -player.height/2, player.width, player.height);
    ctx.restore();

    // Score display (center top)
    ctx.font = '22px system-ui,Inter,Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 6;
    ctx.textAlign = 'center';
    ctx.fillText(score, canvas.width / 2, 48);
    ctx.strokeText(score, canvas.width / 2, 48);

    requestAnimationFrame(loop);
  }

  // ----- Draw helpers -----
  function drawBackground() {
    // subtle gradient sky + ground band
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#9fe0ff');
    grad.addColorStop(0.6, '#dff8ff');
    grad.addColorStop(1, '#bff0ff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ground strip
    ctx.fillStyle = '#7fd17a';
    const groundH = Math.max(28, canvas.height * 0.08);
    ctx.fillRect(0, canvas.height - groundH, canvas.width, groundH);
  }

  function drawGas(c) {
    // We draw the gas image stretched into the obstacle rectangle.
    // For top obstacle (y==0) we flip vertically so it looks like a top cylinder.
    const w = c.width;
    const h = c.height;
    if (c.y === 0) {
      // top - flip
      ctx.save();
      ctx.translate(c.x + w/2, h/2);
      ctx.scale(1, -1);
      // draw centered but reversed
      ctx.drawImage(imgGas, -w/2, -h/2, w, h);
      ctx.restore();
    } else {
      // bottom - normal
      ctx.drawImage(imgGas, c.x, c.y, w, h);
    }
  }

  // ----- Preload safety: show canvas only when images ready -----
  let readyCount = 0;
  const toLoad = [imgPlayer, imgGas, imgFart];
  toLoad.forEach(img => {
    if (img.complete) readyCount++;
    else img.addEventListener('load', () => {
      readyCount++;
      if (readyCount === toLoad.length) drawSplash();
    });
  });
  if (readyCount === toLoad.length) drawSplash();

  function drawSplash() {
    // initial lobby canvas art
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    // big centered gas on top portion
    const W = Math.min(220, canvas.width * 0.4);
    ctx.drawImage(imgGas, canvas.width/2 - W/2, canvas.height*0.12, W, W*1.25);
    // player preview
    const pw = Math.min(110, canvas.width * 0.18);
    ctx.drawImage(imgPlayer, canvas.width/2 - pw/2, canvas.height*0.45, pw, pw);

    // small title
    ctx.font = '28px system-ui,Inter,Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Flappy Fart', canvas.width/2, canvas.height*0.85);
  }

  // Ensure initial draw
  drawSplash();

  // make sure music stops on page hide
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { bgLobby.pause(); bgGame.pause(); }
    else {
      if (gameState === 'lobby') bgLobby.play().catch(()=>{});
      if (gameState === 'playing') bgGame.play().catch(()=>{});
    }
  });

  // expose some debug to window (optional)
  window._ff = { startGame, endGame };
})();
