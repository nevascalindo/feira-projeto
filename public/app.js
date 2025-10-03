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
    if (!name) { alert('Digite seu nome antes de iniciar.'); return; }
    startTime = Date.now();
    penalties = 0;
    setRunning(true);
    statusEl.textContent = 'Contando…';
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
    statusEl.textContent = 'Finalizado! Salvando resultado…';
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, timeMs: finalTime })
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      await res.json();
      statusEl.textContent = `Tempo salvo: ${formatMs(finalTime)}`;
      switchTab('board');
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Não foi possível salvar.';
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
    statusEl.textContent = 'Aguardando início…';
    setRunning(false);
    updateDisplays();
  }

  startBtn.addEventListener('click', start);
  finishBtn.addEventListener('click', finish);
  resetBtn.addEventListener('click', reset);

  if (socket) {
    socket.on('connect', () => {
      console.log('Conectado ao servidor');
    });
    socket.on('interrupt', () => {
      if (startTime != null) {
        penalties += 1;
        updateDisplays();
        // Small flash effect in status
        statusEl.textContent = `Interrupção detectada (+5s)! Total: ${penalties}`;
        setTimeout(() => { if (startTime != null) statusEl.textContent = 'Contando…'; }, 1200);
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
    boardList.innerHTML = '<div class="hint">Carregando…</div>';
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      renderBoard(data);
    } catch (e) {
      boardList.innerHTML = '<div class="hint">Erro ao carregar.</div>';
    }
  }

  function renderBoard(items){
    if (!items.length) {
      boardList.innerHTML = '<div class="hint">Sem resultados ainda. Jogue para aparecer aqui!</div>';
      return;
    }
    boardList.innerHTML = '';
    items.forEach((it, index) => {
      const row = document.createElement('div');
      row.className = 'row';

      const nameCol = document.createElement('div');
      nameCol.className = 'name';
      nameCol.textContent = `${index+1}. ${it.name}`;

      const timeCol = document.createElement('div');
      timeCol.className = 'time';
      timeCol.textContent = formatMs(it.timeMs);

      const controls = document.createElement('div');
      controls.className = 'controls';

      const editBtn = document.createElement('button');
      editBtn.className = 'ghost';
      editBtn.textContent = 'Editar nome';
      editBtn.addEventListener('click', async () => {
        const newName = prompt('Novo nome:', it.name);
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
      deleteBtn.textContent = 'Apagar';
      deleteBtn.addEventListener('click', async () => {
        if (!confirm('Tem certeza que deseja apagar este registro?')) return;
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


