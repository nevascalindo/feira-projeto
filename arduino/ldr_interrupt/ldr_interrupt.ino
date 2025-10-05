/*
  LDR + Laser Interrupt Detector (Módulo com potenciômetro) - Dual Sensor
  - Use a saída digital (DO) do módulo no pino 2 e pino 4
  - Gire o potenciômetro para ajustar o ponto de comutação luz/escuro
  - Envia "INT1" ou "INT2" no momento em que detecta ESCURO (feixe interrompido)
  - Loga mudanças de estado (LIGHT/DARK) e logs periódicos para ambos os sensores

  Observação: muitos módulos saem LOW no escuro e HIGH no claro.
  Se o seu for invertido, troque a lógica de 'isDark = (doValue == LOW)'.

  Serial: 9600 baud (ajuste no servidor se mudar)
*/

const int LDR1_DO_PIN = 2; // DO do módulo 1
const int LDR2_DO_PIN = 4; // DO do módulo 2

const unsigned long stableMs = 80; // tempo que o novo estado deve permanecer para validar

// Estrutura para gerenciar estado de cada sensor
struct LDRState {
  unsigned long lastIntAt;
  bool isDark;
  bool candidateDark;
  unsigned long candidateSince;
};

LDRState ldr1 = {0, false, false, 0};
LDRState ldr2 = {0, false, false, 0};

unsigned long lastStatusAt = 0; // último log periódico
const unsigned long statusIntervalMs = 1000; // log a cada 1s

void setup() {
  pinMode(LDR1_DO_PIN, INPUT);
  pinMode(LDR2_DO_PIN, INPUT);
  Serial.begin(9600);
}

// Função para processar cada sensor LDR
void processLDR(int pin, LDRState& state, int sensorNum) {
  int doValue = digitalRead(pin);
  bool readingDark = (doValue == LOW); // ajuste se seu módulo for invertido

  // Histerese temporal: só troca o estado se a leitura ficar estável por stableMs
  if (readingDark != state.candidateDark) {
    state.candidateDark = readingDark;
    state.candidateSince = millis();
  }

  if (state.candidateDark != state.isDark && (millis() - state.candidateSince) >= stableMs) {
    state.isDark = state.candidateDark;
    Serial.print("STATE");
    Serial.print(sensorNum);
    Serial.print(": ");
    Serial.println(state.isDark ? "DARK" : "LIGHT");
    if (state.isDark) {
      state.lastIntAt = millis();
      Serial.print("INT");
      Serial.println(sensorNum);
    }
  }
}

void loop() {
  // Processar ambos os sensores
  processLDR(LDR1_DO_PIN, ldr1, 1);
  processLDR(LDR2_DO_PIN, ldr2, 2);

  // Log periódico para ambos os sensores
  unsigned long nowTs = millis();
  if (nowTs - lastStatusAt >= statusIntervalMs) {
    lastStatusAt = nowTs;
    
    int doValue1 = digitalRead(LDR1_DO_PIN);
    int doValue2 = digitalRead(LDR2_DO_PIN);
    
    Serial.print("VALUE1: do=");
    Serial.print(doValue1);
    Serial.print(" state=");
    Serial.print(ldr1.isDark ? "DARK" : "LIGHT");
    Serial.print(" | VALUE2: do=");
    Serial.print(doValue2);
    Serial.print(" state=");
    Serial.println(ldr2.isDark ? "DARK" : "LIGHT");
  }

  delay(5);
}


