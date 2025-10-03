/*
  LDR + Laser Interrupt Detector (Módulo com potenciômetro)
  - Use a saída digital (DO) do módulo no pino 2
  - Gire o potenciômetro para ajustar o ponto de comutação luz/escuro
  - Envia "INT" no momento em que detecta ESCURO (feixe interrompido)
  - Loga mudanças de estado (LIGHT/DARK) e logs periódicos

  Observação: muitos módulos saem LOW no escuro e HIGH no claro.
  Se o seu for invertido, troque a lógica de 'isDark = (doValue == LOW)'.

  Serial: 9600 baud (ajuste no servidor se mudar)
*/

const int LDR_DO_PIN = 2; // DO do módulo

const unsigned long stableMs = 80; // tempo que o novo estado deve permanecer para validar

unsigned long lastIntAt = 0;
bool isDark = false; // estado atual validado (true = feixe interrompido)
bool candidateDark = false; // estado candidato ainda não validado
unsigned long candidateSince = 0; // desde quando o candidato difere do atual
unsigned long lastStatusAt = 0; // último log periódico
const unsigned long statusIntervalMs = 1000; // log a cada 1s

void setup() {
  pinMode(LDR_DO_PIN, INPUT);
  Serial.begin(9600);
}

void loop() {
  int doValue = digitalRead(LDR_DO_PIN);
  bool readingDark = (doValue == LOW); // ajuste se seu módulo for invertido

  // Histerese temporal: só troca o estado se a leitura ficar estável por stableMs
  if (readingDark != candidateDark) {
    candidateDark = readingDark;
    candidateSince = millis();
  }

  if (candidateDark != isDark && (millis() - candidateSince) >= stableMs) {
    isDark = candidateDark;
    Serial.print("STATE: ");
    Serial.println(isDark ? "DARK" : "LIGHT");
    if (isDark) {
      lastIntAt = millis();
      Serial.println("INT");
    }
  }

  unsigned long nowTs = millis();
  if (nowTs - lastStatusAt >= statusIntervalMs) {
    lastStatusAt = nowTs;
    Serial.print("VALUE: do=");
    Serial.print(doValue);
    Serial.print(" state=");
    Serial.println(isDark ? "DARK" : "LIGHT");
  }

  delay(5);
}


