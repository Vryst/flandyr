// Konfigurasi Firebase (project flandyr-1). Kunci web ini memang publik; yang menjaga data adalah
// Security Rules di database.rules.json (wajib di-deploy, lihat README bagian "Firebase").
// Game dimuat sebagai file statis, jadi SDK-nya dipasang lewat <script> di index.html (versi compat, tanpa bundler).
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyB_MQoBsfnj6clD_WHETB-gnTvrCUo_suE",
  authDomain: "flandyr-1.firebaseapp.com",
  databaseURL: "https://flandyr-1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "flandyr-1",
  storageBucket: "flandyr-1.firebasestorage.app",
  messagingSenderId: "1069989999555",
  appId: "1:1069989999555:web:ba3ab17ad66b538d138376",
};
