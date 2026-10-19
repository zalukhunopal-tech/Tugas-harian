import os
import shutil
import subprocess
import zipfile

def build_zip():
    print("1. Menjalankan build Vite...")
    subprocess.run(["npm", "run", "build"], check=True)

    base_dir = "/tmp/catatan_keuangan_android"
    if os.path.exists(base_dir):
        shutil.rmtree(base_dir)
    os.makedirs(base_dir, exist_ok=True)

    # 1. Folder Aplikasi Offline Siap Pakai
    offline_dir = os.path.join(base_dir, "Aplikasi-Offline-Siap-Pakai")
    shutil.copytree("dist", offline_dir)
    # Hapus file zip jika ada di dalam dist
    for item in os.listdir(offline_dir):
        if item.endswith(".zip"):
            try:
                os.remove(os.path.join(offline_dir, item))
            except Exception:
                pass

    # Shortcut langsung di root ZIP agar pengguna cukup klik 1 kali
    with open(os.path.join(base_dir, "KLIK_UNTUK_BUKA_APLIKASI.html"), "w", encoding="utf-8") as f:
        f.write('''<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url=Aplikasi-Offline-Siap-Pakai/index.html">
  <title>Membuka Catatan Keuangan...</title>
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; background: #060a18; color: #fff; text-align: center; padding: 40px 16px;">
  <h2>Membuka Aplikasi Catatan Keuangan...</h2>
  <p>Jika aplikasi tidak terbuka otomatis, silakan klik tombol di bawah ini:</p>
  <p style="margin-top: 24px;">
    <a href="Aplikasi-Offline-Siap-Pakai/index.html" style="display: inline-block; padding: 14px 28px; background: #3b82f6; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
      ▶ Buka Aplikasi Catatan Keuangan
    </a>
  </p>
</body>
</html>
''')

    # 2. File Panduan HTML Visual (Sangat ramah pengguna HP)
    with open(os.path.join(base_dir, "PANDUAN_CARA_PASANG_DI_HP.html"), "w", encoding="utf-8") as f:
        f.write('''<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Panduan Pasang Aplikasi di HP Android</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f172a;
      color: #f1f5f9;
      margin: 0;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #1e293b;
      padding: 24px;
      border-radius: 16px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    h1 {
      color: #60a5fa;
      font-size: 1.4rem;
      margin-top: 0;
      border-bottom: 2px solid #334155;
      padding-bottom: 12px;
    }
    h2 {
      color: #38bdf8;
      font-size: 1.15rem;
      margin-top: 24px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: bold;
      background: #0284c7;
      color: #fff;
    }
    .card {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 16px;
      margin: 14px 0;
    }
    .card.rekomendasi {
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.1);
    }
    ol {
      padding-left: 20px;
      margin: 10px 0;
    }
    li {
      margin-bottom: 8px;
    }
    .btn {
      display: inline-block;
      padding: 12px 20px;
      background: #2563eb;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      text-align: center;
      margin-top: 10px;
    }
    .alert {
      background: rgba(234, 179, 8, 0.15);
      border-left: 4px solid #eab308;
      padding: 12px;
      border-radius: 6px;
      font-size: 0.9rem;
      margin: 14px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📱 Panduan Pemasangan di HP Android</h1>

    <div class="alert">
      <strong>⚠️ Kenapa file .zip tidak bisa langsung diinstal?</strong><br>
      Sistem Android tidak mengizinkan file berformat <code>.zip</code> diinstal langsung. Format yang bisa diinstal langsung di HP Android adalah <strong>Web App PWA (hanya 2 ketukan)</strong> atau file <strong>.APK</strong>.
    </div>

    <div class="card rekomendasi">
      <span class="badge">CARA TERMUDAH (HANYA 2 KETUKAN)</span>
      <h2>1. Pasang Langsung dari Browser HP Anda</h2>
      <p>Tidak perlu instal aplikasi apapun atau ekstrak file:</p>

      <p><strong>A. Jika Menggunakan Browser Samsung Internet (di HP Samsung Anda):</strong></p>
      <ol>
        <li>Buka website aplikasi ini di HP Anda.</li>
        <li>Ketuk ikon <strong>Garis Tiga (☰)</strong> di pojok kanan bawah layar.</li>
        <li>Pilih menu <strong>"Tambahkan halaman ke"</strong> (ikon tanda <strong>+</strong>).</li>
        <li>Pilih <strong>"Layar Depan"</strong> (atau "Aplikasi").</li>
        <li>Ketuk <strong>"Tambahkan"</strong>. Selesai!</li>
      </ol>

      <p><strong>B. Jika Menggunakan Google Chrome di Android:</strong></p>
      <ol>
        <li>Buka link aplikasi ini di Chrome.</li>
        <li>Ketuk tanda <strong>Titik Tiga (⋮)</strong> di pojok kanan atas.</li>
        <li>Pilih menu <strong>"Install app"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.</li>
        <li>Ketuk <strong>"Install"</strong>.</li>
      </ol>
      <p style="color: #4ade80; font-weight: bold;">✓ Ikon Catatan Keuangan akan langsung muncul di menu HP Anda dan bisa dibuka kapan saja layaknya aplikasi native dari Play Store!</p>
    </div>

    <div class="card">
      <span class="badge">CARA 2: JALANKAN OFFLINE DARI ZIP INI</span>
      <h2>2. Membuka Aplikasi Offline dari File ZIP Ini</h2>
      <ol>
        <li>Buka folder <strong>Aplikasi-Offline-Siap-Pakai</strong> di dalam ZIP ini.</li>
        <li>Ketuk file <strong>index.html</strong>.</li>
        <li>Pilih buka dengan <strong>Chrome</strong> atau <strong>Samsung Internet</strong>.</li>
        <li>Aplikasi langsung berjalan 100% tanpa internet di ponsel Anda.</li>
      </ol>
      <a href="Aplikasi-Offline-Siap-Pakai/index.html" class="btn">▶ Buka Aplikasi Sekarang</a>
    </div>

    <div class="card">
      <span class="badge">CARA 3: JIKA INGIN FILE .APK SUNGGUHAN</span>
      <h2>3. Cara Membuat & Mengunduh File .APK</h2>
      <p>Jika Anda memerlukan file mentah <code>.apk</code> siap kirim/instal:</p>
      <ol>
        <li>Buka website gratis: <a href="https://www.pwabuilder.com" target="_blank" style="color:#60a5fa;">https://www.pwabuilder.com</a></li>
        <li>Masukkan URL web aplikasi ini di kotak input.</li>
        <li>Klik tombol <strong>Start</strong> lalu pilih <strong>Package for Android</strong>.</li>
        <li>Klik <strong>Download APK</strong>. File .apk akan langsung terunduh ke HP Anda dan siap diinstal!</li>
      </ol>
    </div>
  </div>
</body>
</html>
''')

    # 3. File Panduan Text Biasa (untuk aplikasi pembuka teks HP)
    with open(os.path.join(base_dir, "PANDUAN_CARA_PASANG_DI_HP.txt"), "w", encoding="utf-8") as f:
        f.write('''====================================================================
PANDUAN LENGKAP: CARA MEMASANG APLIKASI CATATAN KEUANGAN DI HP ANDROID
====================================================================

Halo! Jika Anda bingung kenapa file ZIP ini tidak ada tombol "Instal":
Sistem HP Android memang tidak bisa menginstal file berformat .ZIP secara langsung.
Format yang bisa diinstal di Android adalah Web App (PWA) atau file berformat .APK.

Berikut adalah 3 cara paling mudah untuk menggunakannya:

--------------------------------------------------------------------
CARA 1 (PALING MUDAH & DIREKOMENDASIKAN):
PASANG LANGSUNG DI HP ANDA (HANYA 2 KETUKAN)
--------------------------------------------------------------------
A. Jika menggunakan browser Samsung Internet (Browser bawaan HP Samsung):
1. Buka halaman aplikasi ini di HP Anda.
2. Di pojok KANAN BAWAH layar, ketuk tombol Garis Tiga (☰).
3. Cari dan ketuk menu "Tambahkan halaman ke" (simbol tanda tambah +).
4. Pilih "Layar Depan" (atau "Layar Utama" / "Home Screen").
5. Ketuk "Tambahkan" / "Add".

B. Jika menggunakan Google Chrome di Android:
1. Buka halaman aplikasi ini di Google Chrome.
2. Ketuk tombol Titik Tiga (⋮) di pojok KANAN ATAS layar.
3. Pilih menu "Install app" (atau "Tambahkan ke Layar Utama").
4. Ketuk "Install".

HASIL: Ikon aplikasi "Catatan Keuangan" akan langsung terpasang di layar utama HP Anda,
berjalan layar penuh, dan bisa digunakan secara offline!

--------------------------------------------------------------------
CARA 2: JALANKAN SECARA OFFLINE DARI FILE ZIP INI
--------------------------------------------------------------------
1. Ekstrak file ZIP ini di HP Anda.
2. Ketuk file "KLIK_UNTUK_BUKA_APLIKASI.html" atau buka folder "Aplikasi-Offline-Siap-Pakai" lalu ketuk "index.html".
3. Pilih buka dengan browser (Chrome atau Samsung Internet).
4. Aplikasi akan langsung berjalan 100% offline di HP Anda!

--------------------------------------------------------------------
CARA 3: JIKA INGIN FILE MENTAH BERFORMAT .APK
--------------------------------------------------------------------
1. Buka situs resmi & gratis: https://www.pwabuilder.com
2. Masukkan URL aplikasi ini.
3. Klik "Start", lalu pilih "Package for Android" -> "Download APK".
4. File .apk akan langsung tersimpan di HP Anda dan bisa diinstal langsung!
====================================================================
''')

    # 4. Folder Android Studio Project
    android_dir = os.path.join(base_dir, "Android-Studio-Project")
    os.makedirs(android_dir, exist_ok=True)

    with open(os.path.join(android_dir, "settings.gradle"), "w", encoding="utf-8") as f:
        f.write('rootProject.name = "CatatanKeuangan"\ninclude(":app")\n')

    with open(os.path.join(android_dir, "build.gradle"), "w", encoding="utf-8") as f:
        f.write('''buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:8.2.2")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.22")
    }
}
allprojects {
    repositories {
        google()
        mavenCentral()
    }
}
''')

    app_dir = os.path.join(android_dir, "app")
    app_src_dir = os.path.join(app_dir, "src", "main")
    app_java_dir = os.path.join(app_src_dir, "java", "com", "nopal", "catatankeuangan")
    app_res_dir = os.path.join(app_src_dir, "res", "values")
    app_assets_dir = os.path.join(app_src_dir, "assets")

    os.makedirs(app_java_dir, exist_ok=True)
    os.makedirs(app_res_dir, exist_ok=True)
    shutil.copytree("dist", app_assets_dir)
    # Hapus file zip di dalam assets
    for item in os.listdir(app_assets_dir):
        if item.endswith(".zip"):
            try:
                os.remove(os.path.join(app_assets_dir, item))
            except Exception:
                pass

    with open(os.path.join(app_dir, "build.gradle"), "w", encoding="utf-8") as f:
        f.write('''plugins {
    id("com.android.application")
    id("kotlin-android")
}

android {
    namespace = "com.nopal.catatankeuangan"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.nopal.catatankeuangan"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
}
''')

    with open(os.path.join(app_src_dir, "AndroidManifest.xml"), "w", encoding="utf-8") as f:
        f.write('''<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:label="Catatan Keuangan"
        android:supportsRtl="true"
        android:theme="@style/Theme.AppCompat.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
''')

    with open(os.path.join(app_java_dir, "MainActivity.kt"), "w", encoding="utf-8") as f:
        f.write('''package com.nopal.catatankeuangan

import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)

        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true

        webView.webViewClient = WebViewClient()
        webView.loadUrl("file:///android_asset/index.html")
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
''')

    with open(os.path.join(app_res_dir, "strings.xml"), "w", encoding="utf-8") as f:
        f.write('<resources><string name="app_name">Catatan Keuangan</string></resources>')

    # Buat ZIP di public/Catatan-Keuangan-Android.zip
    os.makedirs("public", exist_ok=True)
    zip_path = "public/Catatan-Keuangan-Android.zip"
    print(f"Membuat file zip di {zip_path}...")

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(base_dir):
            for file in files:
                file_full = os.path.join(root, file)
                rel_path = os.path.relpath(file_full, base_dir)
                zipf.write(file_full, rel_path)

    print(f"Selesai! Ukuran zip: {os.path.getsize(zip_path)} bytes")

    # Juga salin zip ke dist jika folder dist ada, agar bisa langsung diunduh tanpa reload
    if os.path.exists("dist"):
        shutil.copy2(zip_path, os.path.join("dist", "Catatan-Keuangan-Android.zip"))

if __name__ == "__main__":
    build_zip()
