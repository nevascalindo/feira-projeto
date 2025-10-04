(function(){
  const socket = typeof io !== 'undefined' ? io() : null;

  // Tabs
  const tabGame = document.getElementById('tab-game');
  const tabBoard = document.getElementById('tab-board');
  const sectionGame = document.getElementById('game');
  const sectionBoard = document.getElementById('board');
  tabGame.addEventListener('click', () => switchTab('game'));
  tabBoard.addEventListener('click', () => switchTab('board'));

  function switchTab(which){
    [tabGame, tabBoard].forEach(t => t.classList.remove('active'));
    [sectionGame, sectionBoard].forEach(s => s.classList.remove('active'));
    if (which === 'game') { tabGame.classList.add('active'); sectionGame.classList.add('active'); }
    else { tabBoard.classList.add('active'); sectionBoard.classList.add('active'); loadBoard(); }
  }

  // Elements
  const nameInput = document.getElementById('player-name');
  const startBtn = document.getElementById('start-btn');
  const finishBtn = document.getElementById('finish-btn');
  const resetBtn = document.getElementById('reset-btn');
  const timeDisplay = document.getElementById('time-display');
  const penaltiesDisplay = document.getElementById('penalties-display');
  const totalDisplay = document.getElementById('total-display');
  const statusEl = document.getElementById('status');

  let startTime = null;
  let timerInterval = null;
  let penalties = 0; // count of interrupts
  const penaltyMs = 5000;
  const maxDurationMs = 2 * 60 * 1000; // 2 minutes

  // Audio context for alarm sound
  let audioContext = null;
  
  function initAudio() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
  
  function playAlarmSound() {
    try {
      initAudio();
      
      // Create multiple oscillators for a more realistic alarm sound
      const oscillator1 = audioContext.createOscillator();
      const oscillator2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Connect nodes
      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Configure the sound - two frequencies for a more alarm-like sound
      oscillator1.frequency.setValueAtTime(800, audioContext.currentTime); // High frequency
      oscillator1.type = 'sine';
      
      oscillator2.frequency.setValueAtTime(1000, audioContext.currentTime); // Even higher frequency
      oscillator2.type = 'sine';
      
      // Create envelope for the "piii" effect - quick and sharp
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.02); // Very quick attack
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.1); // Quick decay
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3); // Short duration
      
      // Play the sound
      oscillator1.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + 0.3);
      
      oscillator2.start(audioContext.currentTime);
      oscillator2.stop(audioContext.currentTime + 0.3);
      
    } catch (error) {
      console.warn('Could not play alarm sound:', error);
    }
  }

  function formatMs(ms){
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;
    return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(millis).padStart(3,'0')}`;
  }

  function updateDisplays(){
    if (startTime == null) {
      timeDisplay.textContent = '00:00.000';
      penaltiesDisplay.textContent = `${penalties} × +5s`;
      totalDisplay.textContent = '00:00.000';
      return;
    }
    const elapsed = Date.now() - startTime;
    const total = elapsed + penalties * penaltyMs;
    timeDisplay.textContent = formatMs(Math.max(0, elapsed));
    penaltiesDisplay.textContent = `${penalties} × +5s`;
    totalDisplay.textContent = formatMs(Math.max(0, total));
  }

  function setRunning(running){
    startBtn.disabled = running;
    finishBtn.disabled = !running;
    resetBtn.disabled = !running;
    nameInput.disabled = running;
  }

  function start(){
    const name = (nameInput.value || '').trim();
    if (!name) { alert('⚠️ Digite seu código de agente antes de iniciar a missão.'); return; }
    startTime = Date.now();
    penalties = 0;
    setRunning(true);
    statusEl.textContent = '🎯 Missão em andamento... Evite os feixes de laser!';
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      updateDisplays();
      const elapsed = Date.now() - startTime;
      if (elapsed >= maxDurationMs) {
        finish();
      }
    }, 50);
    updateDisplays();
  }

  async function finish(){
    if (startTime == null) return;
    const name = (nameInput.value || '').trim();
    const elapsed = Date.now() - startTime;
    const finalTime = elapsed + penalties * penaltyMs;
    clearInterval(timerInterval);
    timerInterval = null;
    setRunning(false);
    statusEl.textContent = '✅ Missão finalizada! Salvando resultado no sistema...';
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, timeMs: finalTime })
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      await res.json();
      statusEl.textContent = `🎉 Missão registrada: ${formatMs(finalTime)} - Verifique o Hall da Fama!`;
      switchTab('board');
    } catch (err) {
      console.error(err);
      statusEl.textContent = '❌ Erro no sistema. Não foi possível salvar a missão.';
    } finally {
      startTime = null;
      updateDisplays();
    }
  }

  function reset(){
    clearInterval(timerInterval);
    timerInterval = null;
    startTime = null;
    penalties = 0;
    statusEl.textContent = '🔄 Sistema pronto. Aguardando nova missão...';
    setRunning(false);
    updateDisplays();
  }

  startBtn.addEventListener('click', start);
  finishBtn.addEventListener('click', finish);
  resetBtn.addEventListener('click', reset);
  
  // Test sound button
  const testSoundBtn = document.getElementById('test-sound-btn');
  testSoundBtn.addEventListener('click', () => {
    playAlarmSound();
    statusEl.textContent = '🔊 Som de alarme testado!';
    setTimeout(() => { 
      if (startTime == null) statusEl.textContent = '🔄 Sistema pronto. Aguardando nova missão...';
      else statusEl.textContent = '🎯 Missão em andamento... Evite os feixes de laser!';
    }, 1000);
  });

  if (socket) {
    socket.on('connect', () => {
      console.log('Conectado ao servidor');
    });
    socket.on('interrupt', () => {
      if (startTime != null) {
        penalties += 1;
        updateDisplays();
        
        // Play alarm sound
        playAlarmSound();
        
        // Flash effect on the entire page
        document.body.style.background = 'radial-gradient(ellipse at center, #ff0000 0%, #000000 100%)';
        setTimeout(() => {
          document.body.style.background = 'radial-gradient(ellipse at center, #0a0a0a 0%, #000000 100%)';
        }, 200);
        
        // Small flash effect in status
        statusEl.textContent = `⚠️ ALERTA! Feixe de laser tocado (+5s)! Total de alertas: ${penalties}`;
        setTimeout(() => { if (startTime != null) statusEl.textContent = '🎯 Missão em andamento... Evite os feixes de laser!'; }, 1200);
      }
    });
  } else {
    console.warn('Socket.IO indisponível. Penalidades não serão contadas automaticamente.');
  }

  // Leaderboard
  const boardList = document.getElementById('board-list');
  const refreshBtn = document.getElementById('refresh-board');
  refreshBtn.addEventListener('click', loadBoard);

  async function loadBoard(){
    boardList.innerHTML = '<div class="hint">🔄 Carregando dados do Hall da Fama...</div>';
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      renderBoard(data);
    } catch (e) {
      boardList.innerHTML = '<div class="hint">❌ Erro ao carregar o Hall da Fama.</div>';
    }
  }

  function renderBoard(items){
    if (!items.length) {
      boardList.innerHTML = '<div class="hint">🚀 Nenhuma missão completada ainda. Seja o primeiro agente a completar o desafio!</div>';
      return;
    }
    boardList.innerHTML = '';
    items.forEach((it, index) => {
      const row = document.createElement('div');
      const position = index + 1;
      
      // Add special classes for top 3
      if (position <= 3) {
        row.className = `row top-3 position-${position}`;
      } else {
        row.className = 'row';
      }

      const nameCol = document.createElement('div');
      nameCol.className = 'name';
      
      // Add special icons for top 3
      let positionIcon = '';
      if (position === 1) positionIcon = '🥇 ';
      else if (position === 2) positionIcon = '🥈 ';
      else if (position === 3) positionIcon = '🥉 ';
      else positionIcon = `${position}. `;
      
      nameCol.textContent = `${positionIcon}${it.name}`;

      const timeCol = document.createElement('div');
      timeCol.className = 'time';
      timeCol.textContent = formatMs(it.timeMs);

      const controls = document.createElement('div');
      controls.className = 'controls';

      const editBtn = document.createElement('button');
      editBtn.className = 'ghost';
      editBtn.textContent = '✏️ Editar';
      editBtn.addEventListener('click', async () => {
        const newName = prompt('Novo código do agente:', it.name);
        if (newName == null) return;
        const name = newName.trim();
        if (!name) return;
        await fetch(`/api/leaderboard/${it.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        loadBoard();
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'danger';
      deleteBtn.textContent = '🗑️ Apagar';
      deleteBtn.addEventListener('click', async () => {
        if (!confirm('⚠️ Tem certeza que deseja apagar este registro da base de dados?')) return;
        await fetch(`/api/leaderboard/${it.id}`, { method: 'DELETE' });
        loadBoard();
      });

      controls.appendChild(editBtn);
      controls.appendChild(deleteBtn);

      row.appendChild(nameCol);
      row.appendChild(timeCol);
      row.appendChild(controls);

      boardList.appendChild(row);
    });
  }

  // Initial state
  updateDisplays();
  loadBoard();
})();


