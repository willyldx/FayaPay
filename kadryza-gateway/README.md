# Kadryza Gateway

> Application Android qui sert de passerelle physique entre le backend Kadryza et les opérateurs Mobile Money (Airtel, Moov).

## Rôle

Le Gateway est un téléphone Android dédié qui :

1. Se connecte au backend via WebSocket (`wss://api.kadryza.app/v1/gateway/ws`)
2. Reçoit les ordres de paiement
3. Exécute les sessions USSD sur les SIM opérateurs
4. Intercepte les SMS de confirmation
5. Renvoie le résultat au backend

## Stack

- **Langage :** Kotlin
- **Build :** Gradle (Kotlin DSL)
- **DI :** Koin
- **WebSocket :** OkHttp
- **Sécurité :** EncryptedSharedPreferences (AndroidX Security)

## Structure

```
kadryza-gateway/
├── app/src/main/
│   ├── AndroidManifest.xml
│   ├── java/com/kadryza/gateway/
│   │   ├── KadryzaGatewayApp.kt    # Application + Koin init
│   │   ├── MainActivity.kt          # Interface principale
│   │   ├── core/                     # Service, Manager, Boot, DeviceInfo
│   │   ├── di/                       # Module Koin (DI)
│   │   ├── heartbeat/               # Heartbeat WebSocket
│   │   ├── protocol/                # Messages WebSocket
│   │   ├── sim/                     # Gestion multi-SIM
│   │   ├── sms/                     # Interception et parsing SMS
│   │   ├── ui/                      # Adaptateurs UI
│   │   ├── ussd/                    # Exécution USSD (AccessibilityService)
│   │   └── websocket/              # Client WebSocket
│   └── res/                         # Ressources Android
└── build.gradle.kts
```

## Prérequis

- Android Studio Hedgehog (2023.1.1) ou plus récent
- JDK 17
- Téléphone Android physique avec accès USSD et SMS

## Build

```bash
# Debug APK
./gradlew assembleDebug

# Release APK
./gradlew assembleRelease
```
