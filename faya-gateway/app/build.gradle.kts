plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.fayapay.gateway"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.fayapay.gateway"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
    }
}

// ─── Version catalog ────────────────────────────────────────────────────────
val okHttpVersion = "4.12.0"
val koinVersion = "3.5.6"
val coroutinesVersion = "1.7.3"
val serializationVersion = "1.6.3"
val dataStoreVersion = "1.0.0"
val lifecycleVersion = "2.7.0"
val workManagerVersion = "2.9.0"

dependencies {

    // ── AndroidX Core ──────────────────────────────────────────────────────
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.activity:activity-ktx:1.9.0")

    // ── Lifecycle ──────────────────────────────────────────────────────────
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:$lifecycleVersion")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:$lifecycleVersion")
    implementation("androidx.lifecycle:lifecycle-service:$lifecycleVersion")

    // ── Coroutines ─────────────────────────────────────────────────────────
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:$coroutinesVersion")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:$coroutinesVersion")

    // ── OkHttp (WebSocket) ─────────────────────────────────────────────────
    implementation("com.squareup.okhttp3:okhttp:$okHttpVersion")
    implementation("com.squareup.okhttp3:logging-interceptor:$okHttpVersion")

    // ── Kotlinx Serialization (JSON protocol) ──────────────────────────────
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:$serializationVersion")

    // ── Koin (Dependency Injection) ────────────────────────────────────────
    implementation("io.insert-koin:koin-android:$koinVersion")

    // ── DataStore (Preferences — gateway config persistence) ───────────────
    implementation("androidx.datastore:datastore-preferences:$dataStoreVersion")

    // ── WorkManager (periodic health check fallback) ───────────────────────
    implementation("androidx.work:work-runtime-ktx:$workManagerVersion")

    // ── Timber (Logging) ───────────────────────────────────────────────────
    implementation("com.jakewharton.timber:timber:5.0.1")

    // ── Testing ────────────────────────────────────────────────────────────
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:$coroutinesVersion")
    testImplementation("io.insert-koin:koin-test:$koinVersion")
    testImplementation("io.insert-koin:koin-test-junit4:$koinVersion")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
}
