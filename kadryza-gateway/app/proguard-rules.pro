# ProGuard rules for kadryza-gateway
# ─────────────────────────────────

# ── Kotlinx Serialization ────────────────────────────────────────────────────
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.kadryza.gateway.**$$serializer { *; }
-keepclassmembers class com.kadryza.gateway.** {
    *** Companion;
}
-keepclasseswithmembers class com.kadryza.gateway.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# ── OkHttp ───────────────────────────────────────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }

# ── Timber ───────────────────────────────────────────────────────────────────
-dontwarn org.jetbrains.annotations.**
