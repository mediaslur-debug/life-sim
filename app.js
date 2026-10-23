import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Konfigurasi Firebase Kamu
const firebaseConfig = {
  apiKey: "AIzaSyBO5EgKM0er9tXOql_mMFXyWm0GgWGqA7Q",
  authDomain: "life-sim-37cf9.firebaseapp.com",
  projectId: "life-sim-37cf9",
  storageBucket: "life-sim-37cf9.firebasestorage.app",
  messagingSenderId: "807477304749",
  appId: "1:807477304749:web:77493cca0b32ad73299524"
};

// Gemini API Key Kamu
const GEMINI_API_KEY = "AQ.Ab8RN6KX48K6dftD18Wez4EU72SIK431voXNdy8jPyOfqdbViw";
const MODEL_NAME = "gemini-3.6-flash";

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

// Autentikasi Anonymous Otomatis
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    elUserStatus.innerText = `ID: ${user.uid.slice(0, 5)}...`;
    await muatAtauBuatKarakter(user.uid);
  } else {
    signInAnonymously(auth).catch((err) => {
      console.error("Gagal Login Anonymous:", err);
      elUserStatus.innerText = "Gagal Login";
    });
  }
});

async function muatAtauBuatKarakter(uid) {
  try {
    const userRef = doc(db, "users", uid);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      characterData = docSnap.data();
    } else {
      characterData = {
        nama: "Rian",
        umur: 20,
        uang: 500,
        energi: 100,
        stres: 10,
        ceritaTerakhir: "Kamu baru saja menginjak usia 20 tahun dan memutuskan hidup mandiri di kota besar dengan modal pas-pasan. Langkah apa yang mau kamu ambil pertama kali?",
        opsiTerakhir: [
          "Mencari pekerjaan serabutan di kafe demi menyambung hidup",
          "Mencoba peruntungan melamar kerja kantoran",
          "Santai dulu dan keliling kota mencari kenalan baru"
        ],
        memoryLog: ["Memulai kehidupan mandiri di kota besar pada usia 20 tahun."]
      };
      await setDoc(userRef, characterData);
    }
    updateUI();
    tampilkanCeritaTerakhir();
  } catch (err) {
    console.error("Gagal memuat database:", err);
    elStory.innerText = "Gagal memuat data game dari Firebase. Periksa koneksi atau izin database.";
  }
}

function updateUI() {
  if (!characterData) return;
  elNama.innerText = characterData.nama;
  elUmur.innerText = characterData.umur;
  elUang.innerText = `$${characterData.uang}`;
  elEnergi.innerText = `${characterData.energi}%`;
  elStres.innerText = `${characterData.stres}%`;
}

function tampilkanCeritaTerakhir() {
  if (!characterData) return;
  elStory.innerText = characterData.ceritaTerakhir;
  buatTombolOpsi(characterData.opsiTerakhir);
}

function buatTombolOpsi(opsiArray) {
  elOptions.innerHTML = "";
  if (!opsiArray) return;
  opsiArray.forEach((opsi) => {
    const btn = document.createElement("button");
    btn.className = "btn-option";
    btn.innerText = opsi;
    btn.onclick = () => prosesPilihan(opsi);
    elOptions.appendChild(btn);
  });
}

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
  2. Tentukan perubahan status karakter (uang bisa bertambah/berkurang, energi naik/turun, stres naik/turun, umur bisa bertambah jika waktunya lewat).
  3. Berikan 3 opsi aksi baru yang relevan untuk kelanjutan cerita berikutnya.
  4. Berikan 1 kalimat ringkasan singkat dari kejadian ini untuk dimasukkan ke memori jangka panjang.

  Balas HARUS dalam format JSON murni TANPA blok markdown code (seperti \`\`\`json):
  {
    "narasi": "Teks cerita...",
    "perubahan": {
      "uang": 50,
      "energi": -10,
      "stres": 5,
      "tambahUmur": 0
    },
    "opsiBaru": ["Opsi 1", "Opsi 2", "Opsi 3"],
    "memoriBaru": "Poin memori penting..."
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
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Respons AI kosong.");
    }

    let text = data.candidates[0].content.parts[0].text;
    // Bersihkan format markdown jika AI tidak sengaja menyсерtakannya
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const hasil = JSON.parse(text);

    // Update data lokal
    characterData.uang += hasil.perubahan.uang || 0;
    characterData.energi = Math.max(0, Math.min(100, characterData.energi + (hasil.perubahan.energi || 0)));
    characterData.stres = Math.max(0, Math.min(100, characterData.stres + (hasil.perubahan.stres || 0)));
    characterData.umur += hasil.perubahan.tambahUmur || 0;
    
    characterData.ceritaTerakhir = hasil.narasi;
    characterData.opsiTerakhir = hasil.opsiBaru;

    if (hasil.memoriBaru) {
      characterData.memoryLog.push(hasil.memoriBaru);
      if (characterData.memoryLog.length > 15) {
        characterData.memoryLog.shift();
      }
    }

    // Simpan ke Firebase Firestore
    const userRef = doc(db, "users", currentUser.uid);
    await setDoc(userRef, characterData);

    updateUI();
    tampilkanCeritaTerakhir();

  } catch (err) {
    console.error("Gagal memproses AI/Database:", err);
    alert("Terjadi kesalahan saat memproses pilihan dengan AI. Coba klik tombol opsi sekali lagi.");
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
