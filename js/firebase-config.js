

import { initializeApp }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth }             from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDFuMlM1uPao1vy0BJLfhxN9cgs0izVbHI",
  authDomain: "neu-library-d5983.firebaseapp.com",
  projectId: "neu-library-d5983",
  storageBucket: "neu-library-d5983.firebasestorage.app",
  messagingSenderId: "105146227462",
  appId: "1:105146227462:web:6cb62b75435db9c1eb1c87"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
