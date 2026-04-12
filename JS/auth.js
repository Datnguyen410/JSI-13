import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBkRVxum-TEk1f3KGjOQw3KAY8j1S8wiq8",
  authDomain: "project-a830b.firebaseapp.com",
  projectId: "project-a830b",
  storageBucket: "project-a830b.firebasestorage.app",
  messagingSenderId: "1094924509327",
  appId: "1:1094924509327:web:6d1eb75aec1f8cb59a10fa",
  measurementId: "G-6FQNVDQVSP",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const usersCollection = collection(db, "users");

function showError(message) {
  const existing = document.querySelector(".message-box");
  if (existing) existing.remove();

  const box = document.createElement("div");
  box.className = "message-box";
  box.textContent = message;
  document.querySelector(".auth-card").insertAdjacentElement("afterbegin", box);
}

function saveSession(user) {
  localStorage.setItem("confess_current_user", JSON.stringify(user));
}

async function findUserByEmail(email) {
  const q = query(usersCollection, where("email", "==", email));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function registerUser({ name, email, password }) {
  const existing = await findUserByEmail(email);
  if (existing.length > 0) {
    throw new Error(
      "Email này đã được sử dụng. Vui lòng đăng nhập hoặc chọn email khác.",
    );
  }

  const result = await addDoc(usersCollection, {
    name,
    email,
    password,
    createdAt: serverTimestamp(),
    role: "user",
  });

  return { id: result.id, name, email, role: "user" };
}

async function loginUser({ email, password }) {
  const existing = await findUserByEmail(email);
  if (existing.length === 0) {
    throw new Error("Email không tồn tại. Vui lòng đăng ký trước.");
  }

  const user = existing[0];
  if (user.password !== password) {
    throw new Error("Sai mật khẩu. Vui lòng thử lại.");
  }

  return user;
}

function initLoginPage() {
  const loginForm = document.getElementById("login-form");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = loginForm.email.value.trim();
    const password = loginForm.password.value.trim();

    try {
      const user = await loginUser({ email, password });
      saveSession({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
      window.location.href = "./Home.html";
    } catch (error) {
      showError(error.message);
    }
  });
}

function initSignupPage() {
  const signupForm = document.getElementById("signup-form");
  if (!signupForm) return;

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = signupForm.name.value.trim();
    const email = signupForm.email.value.trim();
    const password = signupForm.password.value;
    const confirmPassword = signupForm.confirmPassword.value;

    if (password !== confirmPassword) {
      showError("Mật khẩu không khớp. Vui lòng kiểm tra lại.");
      return;
    }

    if (password.length < 6) {
      showError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    try {
      const user = await registerUser({ name, email, password });
      saveSession(user);
      window.location.href = "./Home.html";
    } catch (error) {
      showError(error.message);
    }
  });
}

initLoginPage();
initSignupPage();
