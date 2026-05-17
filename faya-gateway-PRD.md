# PRD — faya-gateway
> Document de référence pour Cursor. Lire entièrement avant de générer du code.
> Ce projet fait partie du monorepo `fayapay/faya-gateway/`

---

## 1. Contexte du projet

`faya-gateway` est une application Android native (Kotlin) qui tourne en permanence
sur un device Android physique dédié, branché en continu sur secteur.

Son rôle est d'être le pont physique entre le backend FayaPay et les opérateurs
Mobile Money tchadiens (Airtel Money, Moov Money) en l'absence d'API officielle.

Il fait deux choses critiques :
1. **Intercepter les SMS** de confirmation envoyés par les opérateurs après chaque transaction
2. **Exécuter les sessions USSD** pour initier les paiements programmatiquement

Il communique avec `faya-backend` via une connexion WebSocket persistante et sécurisée.

---

## 2. Stack technique

| Couche | Technologie | Version |
|---|---|---|
| Language | Kotlin | 1.9+ |
| Min SDK | Android | API 26 (Android 8.0) |
| Target SDK | Android | API 34 |
| Build | Gradle (Kotlin DSL) | 8.x |
| WebSocket | OkHttp | 4.12.x |
| Serialization | Kotlinx Serialization | 1.6.x |
| DI | Koin | 3.5.x |
| Coroutines | Kotlinx Coroutines | 1.7.x |
| Background | Foreground Service + WorkManager | — |
| Logs | Timber | 5.x |
| Preferences | DataStore (Proto) | 1.0.x |

---

## 3. Structure des dossiers

```
faya-gateway/
├── app/
│   ├── src/main/
│   │   ├── java/com/fayapay/gateway/
│   │   │   ├── MainActivity.kt               # UI minimaliste (statut + logs)
│   │   │   ├── FayaGatewayApp.kt             # Application class (Koin init)
│   │   │   ├── core/
│   │   │   │   ├── GatewayService.kt         # Foreground Service principal
│   │   │   │   ├── GatewayManager.kt         # Orchestrateur central
│   │   │   │   └── DeviceInfo.kt             # ID unique du device
│   │   │   ├── websocket/
│   │   │   │   ├── WebSocketClient.kt        # Connexion OkHttp WebSocket
│   │   │   │   ├── WebSocketReconnector.kt   # Reconnexion automatique
│   │   │   │   └── MessageHandler.kt         # Routing des messages entrants
│   │   │   ├── sms/
│   │   │   │   ├── SmsReceiver.kt            # BroadcastReceiver SMS
│   │   │   │   ├── SmsParser.kt              # Parser regex Airtel + Moov
│   │   │   │   └── SmsFilter.kt              # Filtrer SMS opérateurs uniquement
│   │   │   ├── ussd/
│   │   │   │   ├── UssdExecutor.kt           # Lancement session USSD
│   │   │   │   ├── UssdAccessibilityService.kt # Navigation menus USSD
│   │   │   │   └── UssdSessionManager.kt     # Gestion état session USSD
│   │   │   ├── sim/
│   │   │   │   ├── SimManager.kt             # Détection SIMs disponibles
│   │   │   │   └── SimSelector.kt            # Sélection SIM selon opérateur
│   │   │   ├── protocol/
│   │   │   │   ├── IncomingMessage.kt        # Types messages Backend → Gateway
│   │   │   │   └── OutgoingMessage.kt        # Types messages Gateway → Backend
│   │   │   ├── heartbeat/
│   │   │   │   └── HeartbeatManager.kt       # Ping/Pong toutes les 30s
│   │   │   └── di/
│   │   │       └── AppModule.kt              # Koin modules
│   │   ├── res/
│   │   │   ├── layout/activity_main.xml      # UI simple : statut + log scroll
│   │   │   └── values/strings.xml
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts
├── build.gradle.kts
├── settings.gradle.kts
└── gradle.properties
```

---

## 4. Permissions Android requises (AndroidManifest.xml)

```xml
<!-- SMS -->
<uses-permission android:name="android.permission.RECEIVE_SMS"/>
<uses-permission android:name="android.permission.READ_SMS"/>

<!-- Réseau -->
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>

<!-- Background -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC"/>
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"/>
<uses-permission android:name="android.permission.WAKE_LOCK"/>
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>

<!-- Téléphonie -->
<uses-permission android:name="android.permission.CALL_PHONE"/>
<uses-permission android:name="android.permission.READ_PHONE_STATE"/>
<uses-permission android:name="android.permission.READ_PHONE_NUMBERS"/>

<!-- USSD via AccessibilityService -->
<uses-permission android:name="android.permission.BIND_ACCESSIBILITY_SERVICE"/>
```

---

## 5. Composants critiques — détail

### 5.1 GatewayService (Foreground Service)

C'est le composant le plus important. Il tourne en permanence, même quand l'app est en arrière-plan ou que l'écran est éteint.

```kotlin
// Comportement attendu :
// - Démarre au boot du téléphone (via BootReceiver)
// - Affiche une notification persistante avec le statut de connexion
// - Redémarre automatiquement si Android le tue (START_STICKY)
// - Lance WebSocketClient + HeartbeatManager au démarrage
// - Ne jamais s'arrêter sauf ordre explicite de l'utilisateur

// Notification permanente :
// Titre : "FayaPay Gateway"
// Texte : "Connecté — Airtel ✓ Moov ✓" ou "Déconnecté — Reconnexion..."
// Icône : icône simple de connexion
```

### 5.2 WebSocketClient

```kotlin
// Comportement attendu :
// - Connexion à wss://api.fayapay.app/v1/gateway/ws
// - Header d'auth : "Authorization: Bearer <GATEWAY_TOKEN>"
// - Envoyer le gateway_id (UUID unique du device) à la connexion
// - Sur déconnexion : déléguer à WebSocketReconnector
// - Recevoir les messages JSON et les router vers MessageHandler
// - Thread-safe : utiliser des coroutines, pas de callbacks raw
```

### 5.3 WebSocketReconnector

```kotlin
// Backoff exponentiel de reconnexion :
// Tentative 1 : attendre 2 secondes
// Tentative 2 : attendre 4 secondes
// Tentative 3 : attendre 8 secondes
// Tentative 4+ : attendre 30 secondes (plafonner)
// Reset le compteur dès qu'une connexion réussit
// Mettre à jour la notification avec "Reconnexion en cours..."
```

### 5.4 SmsReceiver (BroadcastReceiver)

```kotlin
// Écouter : android.provider.Telephony.SMS_RECEIVED
// Filtrer uniquement les SMS venant des numéros opérateurs :
//   Airtel Money : numéros courts tchadiens (ex: 1234, AIRTEL, etc.)
//   Moov Money   : numéros courts tchadiens (ex: 5678, MOOV, etc.)
// Sur SMS reçu d'un opérateur → passer à SmsParser
// Les numéros exacts seront configurés après test terrain (Phase 0)
```

### 5.5 SmsParser

```kotlin
// IMPORTANT : Les regex ici sont des PLACEHOLDERS.
// Les vrais formats SMS Airtel et Moov Tchad doivent être
// capturés sur le terrain avant d'implémenter les vraies regex.
// Prévoir une architecture flexible pour ajouter/modifier les patterns
// sans recompiler l'app (via config DataStore ou fichier JSON).

data class ParsedSms(
    val success: Boolean,
    val amount: Long?,           // En entiers XAF
    val senderPhone: String?,
    val reference: String?,
    val operator: OperatorType,
    val rawSms: String
)

// Placeholder patterns à remplacer après Phase 0 terrain :
// Airtel : "Vous avez recu {amount} FCFA de {phone}. Ref: {ref}"
// Moov   : "Transaction de {amount} F CFA recue de {phone}. ID: {ref}"
```

### 5.6 UssdExecutor

```kotlin
// Lancer une session USSD via TelecomManager :
// telecomManager.handleMmiCode("*880*1*{phone}*{amount}#")
// ou via Intent ACTION_CALL avec uri "tel:*880*..."
//
// IMPORTANT : Les codes USSD exacts d'Airtel et Moov Tchad
// doivent être documentés sur le terrain (Phase 0).
// Prévoir une configuration dynamique des codes USSD.
//
// Timeout : si pas de réponse AccessibilityService en 30s → FAILED
```

### 5.7 UssdAccessibilityService

```kotlin
// Service d'accessibilité pour naviguer les popups USSD système.
// Android affiche les réponses USSD dans une AlertDialog système
// que seul AccessibilityService peut lire et avec laquelle interagir.
//
// Comportement :
// - Détecter l'ouverture d'une AlertDialog USSD
// - Lire le texte de la réponse
// - Si confirmation demandée → cliquer "OK" automatiquement
// - Si menu numéroté → entrer le bon chiffre
// - Transmettre le résultat à UssdSessionManager
//
// CRITIQUE : Ce service doit être activé manuellement dans
// Paramètres > Accessibilité > FayaPay Gateway
// Guider l'utilisateur depuis MainActivity si non activé.
```

### 5.8 SimManager + SimSelector

```kotlin
// SimManager :
// - Détecter les SIMs présentes (SubscriptionManager)
// - Identifier l'opérateur de chaque SIM (carrier name)
// - Exposer : Map<OperatorType, SubscriptionInfo>
//
// SimSelector :
// - Choisir la bonne SIM selon l'opérateur de la transaction
// - AIRTEL → SIM Airtel, MOOV → SIM Moov
// - Si SIM absente → retourner erreur SIM_NOT_AVAILABLE
```

### 5.9 HeartbeatManager

```kotlin
// Toutes les 30 secondes :
// - Envoyer message PONG au backend avec :
//   gateway_id, statut SIMs, timestamp
// - Si pas de réponse backend en 60s → considérer connexion morte
//   → déclencher reconnexion
```

---

## 6. Protocole des messages (reprend faya-backend PRD)

### Messages reçus du backend (IncomingMessage.kt)

```kotlin
@Serializable
sealed class IncomingMessage {

    @Serializable
    @SerialName("INITIATE_PAYMENT")
    data class InitiatePayment(
        val transaction_id: String,
        val amount: Long,
        val phone_number: String,
        val operator: String          // "AIRTEL" ou "MOOV"
    ) : IncomingMessage()

    @Serializable
    @SerialName("PING")
    object Ping : IncomingMessage()
}
```

### Messages envoyés au backend (OutgoingMessage.kt)

```kotlin
@Serializable
sealed class OutgoingMessage {

    @Serializable
    @SerialName("ACK")
    data class Ack(val transaction_id: String) : OutgoingMessage()

    @Serializable
    @SerialName("USSD_STARTED")
    data class UssdStarted(val transaction_id: String) : OutgoingMessage()

    @Serializable
    @SerialName("SMS_RECEIVED")
    data class SmsReceived(
        val transaction_id: String,
        val sms_raw: String,
        val parsed: ParsedSmsPayload
    ) : OutgoingMessage()

    @Serializable
    @SerialName("OPERATION_FAILED")
    data class OperationFailed(
        val transaction_id: String,
        val reason: String            // "USSD_TIMEOUT", "SIM_NOT_AVAILABLE", "PARSE_ERROR"
    ) : OutgoingMessage()

    @Serializable
    @SerialName("PONG")
    data class Pong(
        val gateway_id: String,
        val sim_status: Map<String, String>   // {"AIRTEL": "ACTIVE", "MOOV": "ACTIVE"}
    ) : OutgoingMessage()
}

@Serializable
data class ParsedSmsPayload(
    val amount: Long?,
    val sender: String?,
    val reference: String?,
    val success: Boolean
)
```

---

## 7. Configuration (DataStore)

Stocker en DataStore (persisté sur le device) :

```kotlin
data class GatewayConfig(
    val gatewayId: String,        // UUID généré une fois, jamais changé
    val backendUrl: String,       // "wss://api.fayapay.app/v1/gateway/ws"
    val gatewayToken: String,     // Token JWT fourni par le backend
    val airtelSenderNumbers: List<String>,  // Numéros courts Airtel
    val moovSenderNumbers: List<String>,    // Numéros courts Moov
    val airtelUssdCode: String,   // Code USSD Airtel (configurable)
    val moovUssdCode: String      // Code USSD Moov (configurable)
)
```

---

## 8. MainActivity — UI minimaliste

L'app n'a pas besoin d'une belle UI. C'est un outil technique.

```
┌─────────────────────────────┐
│  FayaPay Gateway            │
│                             │
│  Statut : ● Connecté        │
│  Backend : api.fayapay.app  │
│                             │
│  SIM Airtel  : ✓ Active     │
│  SIM Moov    : ✓ Active     │
│                             │
│  Transactions aujourd'hui : 12 │
│  Dernière : il y a 3 min    │
│                             │
│  ┌─────────────────────┐   │
│  │ [Démarrer Service]  │   │
│  │ [Arrêter Service]   │   │
│  └─────────────────────┘   │
│                             │
│  — Logs —                   │
│  10:32 SMS reçu Airtel ✓    │
│  10:31 USSD lancé           │
│  10:31 Paiement initié      │
└─────────────────────────────┘
```

---

## 9. BootReceiver

```kotlin
// Démarrer automatiquement GatewayService au boot du téléphone
// Action : android.intent.action.BOOT_COMPLETED
// Démarrer GatewayService en foreground immédiatement
```

---

## 10. Règles critiques pour Cursor

1. **Foreground Service obligatoire** — jamais de background service classique, Android le tuera
2. **Coroutines partout** — pas de Thread ou AsyncTask, utiliser viewModelScope / lifecycleScope
3. **SmsReceiver déclaré dans le Manifest** — pas d'enregistrement dynamique
4. **AccessibilityService déclaré dans le Manifest** avec la bonne configuration XML
5. **Gateway ID généré une seule fois** au premier lancement, stocké en DataStore, jamais régénéré
6. **Les regex SMS sont des placeholders** — architecture doit permettre mise à jour sans recompilation
7. **Gestion des permissions runtime** — demander READ_SMS, RECEIVE_SMS, CALL_PHONE au démarrage avec explication claire
8. **Ne jamais crasher silencieusement** — tout try/catch doit logger avec Timber et notifier le backend si transaction en cours
9. **Tests unitaires pour SmsParser** — c'est le composant le plus critique et le plus facile à tester
10. **Un seul GatewayService instance** — utiliser START_STICKY et vérifier si déjà en cours avant de démarrer

---

## 11. Variables de configuration

```kotlin
// Dans GatewayConfig (DataStore) — à configurer au premier lancement :
BACKEND_WSS_URL = "wss://api.fayapay.app/v1/gateway/ws"
GATEWAY_TOKEN   = "<token fourni par faya-backend à la création du gateway>"
HEARTBEAT_INTERVAL_MS = 30_000L      // 30 secondes
RECONNECT_MAX_DELAY_MS = 30_000L     // 30 secondes max
USSD_TIMEOUT_MS = 30_000L            // 30 secondes
```

---

## 12. Ce qui sera défini après Phase 0 terrain

Ces éléments ne peuvent pas être codés en dur maintenant.
Ils seront remplis après avoir capturé les vrais SMS au Tchad :

```
- Numéros courts Airtel Money Tchad (sender des SMS)
- Numéros courts Moov Money Tchad (sender des SMS)
- Format exact des SMS de confirmation Airtel
- Format exact des SMS de confirmation Moov
- Codes USSD exacts Airtel Money Tchad
- Codes USSD exacts Moov Money Tchad
- Séquence de navigation des menus USSD
```

L'architecture doit être prête à recevoir ces informations
via DataStore sans recompilation de l'app.
