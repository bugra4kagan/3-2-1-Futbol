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
