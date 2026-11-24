
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB7_Zd8h0zoono26SJ1W74kYkQwTTwczAM",
  authDomain: "spotify-recommender-c2881.firebaseapp.com",
  projectId: "spotify-recommender-c2881",
  storageBucket: "spotify-recommender-c2881.firebasestorage.app",
  messagingSenderId: "327372378117",
  appId: "1:327372378117:web:be61325645cecc6b2124c6c",
  measurementId: "G-KGHG6Z62QG"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
