// Import fungsi Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Konfigurasi langsung di sini
const firebaseConfig = {
  apiKey: "AIzaSyBO5EgKM0er9tXOql_mMFXyWm0GgWGqA7Q",
  authDomain: "life-sim-37cf9.firebaseapp.com",
  projectId: "life-sim-37cf9",
  storageBucket: "life-sim-37cf9.firebasestorage.app",
  messagingSenderId: "807477304749",
  appId: "1:807477304749:web:77493cca0b32ad73299524"
};

const GEMINI_API_KEY = "AQ.Ab8RN6IGr1pG8gT8XxVpCpN2cZNw6MJ4xczJW3EWsad62cngFg";
const MODEL_NAME = "gemini-2.5-flash";

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let characterData = null;

// Elemen UI
const elNama = document.getElementById("stat-nama");
const elUmur = document.getElementById("stat-umur");
const elUang = document.getElementById("stat-uang");
const elEnergi = document.getElementById("stat-energi");
const elStres = document.getElementById("stat-stres");
const elStory = document.getElementById("story-text");
const elOptions = document.getElementById("options-container");
const elLoading = document.getElementById("loading-indicator");
const elUserStatus = document.getElementById("user-status");

// Autentikasi Pengguna
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    elUserStatus.innerText = `ID: ${user.uid.slice(0, 6)}...`;
    await muatAtauBuatKarakter(user.uid);
  } else {
    signInAnonymously(auth).catch((err) => console.error("Gagal Login:", err));
  }
});

// Memuat data pemain dari Firestore atau membuat baru jika belum ada
async function muatAtauBuatKarakter(uid) {
  const userRef = doc(db, "users", uid);
  const docSnap = await getDoc(userRef);

  if (docSnap.exists()) {
    characterData = docSnap.data();
    updateUI();
    tampilkanCeritaTerakhir();
  } else {
    characterData = {
      nama: "Rian",
      umur: 20,
      uang: 500,
      energi: 100,
      stres: 10,
      ceritaTerakhir: "Kamu baru saja lulus dan pindah ke kota besar dengan tabungan seadanya. Apa langkah pertamamu?",
      opsiTerakhir: [
        "Mencari pekerjaan paruh waktu di kafe lokal",
        "Mendaftar wawancara kerja di perusahaan IT",
        "Jalan-jalan mengeksplorasi kota"
      ],
      memoryLog: ["Pindah ke kota besar pada umur 20 tahun."]
    };
    await setDoc(userRef, characterData);
    updateUI();
    tampilkanCeritaTerakhir();
  }
}

function updateUI() {
  elNama.innerText = characterData.nama;
  elUmur.innerText = characterData.umur;
  elUang.innerText = `$${characterData.uang}`;
  elEnergi.innerText = `${characterData.energi}%`;
  elStres.innerText = `${characterData.stres}%`;
}

function tampilkanCeritaTerakhir() {
  elStory.innerText = characterData.ceritaTerakhir;
  buatTombolOpsi(characterData.opsiTerakhir);
}

function buatTombolOpsi(opsiArray) {
  elOptions.innerHTML = "";
  opsiArray.forEach((opsi) => {
    const btn = document.createElement("button");
    btn.className = "btn-option";
    btn.innerText = opsi;
    btn.onclick = () => prosesPilihan(opsi);
    elOptions.appendChild(btn);
  });
}

// Mengirim aksi pilihan ke Gemini AI
async function prosesPilihan(pilihan) {
  tampilkanLoading(true);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

  const systemPrompt = `
  Kamu adalah Game Master untuk game simulasi kehidupan dewasa dinamis.
  
  Status Karakter Saat Ini:
  - Nama: ${characterData.nama}
  - Umur: ${characterData.umur} tahun
  - Uang: $${characterData.uang}
  - Energi: ${characterData.energi}%
  - Stres: ${characterData.stres}%
  - Ringkasan Ingatan Masa Lalu: ${characterData.memoryLog.join(" | ")}

  Pemain baru saja memilih aksi: "${pilihan}".

  Tugasmu:
  1. Tuliskan kelanjutan narasi cerita yang menarik dan realistis berdasarkan pilihan tersebut (2-4 kalimat).
  2. Tentukan perubahan status karakter (uang, energi, stres, umur bertambah jika perlu).
  3. Berikan 3 opsi aksi baru untuk giliran berikutnya.
  4. Berikan 1 kalimat ringkasan singkat dari kejadian ini untuk dimasukkan ke memori jangka panjang jika ada kejadian penting.

  Balas HARUS dalam format JSON murni tanpa markdown/format teks lain:
  {
    "narasi": "Teks cerita...",
    "perubahan": {
      "uang": 50,
      "energi": -10,
      "stres": 5,
      "tambahUmur": 0
    },
    "opsiBaru": ["Opsi 1", "Opsi 2", "Opsi 3"],
    "memoriBaru": "Poin memori jika penting atau kosongkan jika biasa saja"
  }
  `;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }]
      })
    });

    const data = await response.json();
    let text = data.candidates[0].content.parts[0].text;
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const hasil = JSON.parse(text);

    characterData.uang += hasil.perubahan.uang || 0;
    characterData.energi = Math.max(0, Math.min(100, characterData.energi + (hasil.perubahan.energi || 0)));
    characterData.stres = Math.max(0, Math.min(100, characterData.stres + (hasil.perubahan.stres || 0)));
    characterData.umur += hasil.perubahan.tambahUmur || 0;
    
    characterData.ceritaTerakhir = hasil.narasi;
    characterData.opsiTerakhir = hasil.opsiBaru;

    if (hasil.memoriBaru && hasil.memoriBaru.length > 0) {
      characterData.memoryLog.push(hasil.memoriBaru);
      if (characterData.memoryLog.length > 10) {
        characterData.memoryLog.shift();
      }
    }

    const userRef = doc(db, "users", currentUser.uid);
    await setDoc(userRef, characterData);

    updateUI();
    tampilkanCeritaTerakhir();

  } catch (err) {
    console.error("Gagal memproses AI:", err);
    alert("Terjadi masalah saat terhubung ke AI. Coba lagi.");
  } finally {
    tampilkanLoading(false);
  }
}

function tampilkanLoading(isLoading) {
  if (isLoading) {
    elLoading.classList.remove("hidden");
  } else {
    elLoading.classList.add("hidden");
  }
}
