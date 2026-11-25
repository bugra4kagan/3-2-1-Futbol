# R8 / ProGuard kuralları — 3-2-1 Futbol: Bilgi Yarışması
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Capacitor Köprüsü
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }

# Google AdMob SDK
-keep class com.google.android.gms.ads.** { *; }
-keep class com.getcapacitor.community.admob.** { *; }

# Firebase Auth & Firestore
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# Google Play Billing Library v9.1.0 & Firebase App Check Play Integrity
-keep class com.android.billingclient.** { *; }
-keep class com.google.firebase.appcheck.** { *; }
-keep class com.google.android.play.core.integrity.** { *; }
-keep class com.futbol321.challenge.PlayBillingPlugin { *; }
-keep class com.futbol321.challenge.PlayIntegrityPlugin { *; }
