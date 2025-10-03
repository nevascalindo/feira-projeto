## Jogo do Laser (Arduino + Node.js)

Projeto com servidor Node.js + Socket.IO que recebe eventos de interrupção de luz (Arduino com LDR) e aplica penalidade de +5s no tempo do jogador. Inclui interface web com jogo (timer 2 minutos) e ranking com edição e remoção, persistido em JSON.

### Requisitos
- Node.js 18+
- Arduino UNO/Nano (ou similar) com LDR e laser
- Porta serial disponível (Windows exemplo: `COM3`)

### Instalação
```bash
npm install
```

### Executar
Defina a porta serial no ambiente (Windows PowerShell):
```powershell
$env:SERIAL_PORT="COM3"
# Opcional: $env:SERIAL_BAUD_RATE="9600"
npm run start
```
Abra `http://localhost:3000`.

Se não configurar `SERIAL_PORT`, o servidor roda sem Arduino e o jogo funciona, mas sem penalidades automáticas.

### Arduino
Código em `arduino/ldr_interrupt/ldr_interrupt.ino`.

Ligações sugeridas:
- LDR entre 5V e `A0`
- Resistor 10k entre `A0` e GND (divisor)
- LED opcional no pino 13 (indicador)

O sketch calibra um baseline de luz ambiente e envia `INT` via Serial a cada interrupção (queda brusca de luz). Mantenha a mesma velocidade (9600) no servidor.

### Endpoints
- GET `/api/leaderboard`: lista ordenada por `timeMs`
- POST `/api/leaderboard` `{ name, timeMs }`
- PUT `/api/leaderboard/:id` `{ name?, timeMs? }`
- DELETE `/api/leaderboard/:id`

Dados ficam em `data/leaderboard.json`.

### Frontend
- Aba Jogo: inserir nome, iniciar, finalizar, resetar; penalidades +5s por `interrupt` via Socket.IO
- Aba Ranking: listar, editar nome e apagar

### Dicas
- Se o ambiente estiver muito claro/escuro, ajuste `thresholdDrop` no sketch
- Verifique no Gerenciador de Dispositivos qual é a sua `COM`


