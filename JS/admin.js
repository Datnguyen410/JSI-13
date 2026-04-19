// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBkRVxum-TEk1f3KGjOQw3KAY8j1S8wiq8",
  authDomain: "project-a830b.firebaseapp.com",
  projectId: "project-a830b",
  storageBucket: "project-a830b.firebasestorage.app",
  messagingSenderId: "1094924509327",
  appId: "1:1094924509327:web:6d1eb75aec1f8cb59a10fa",
  measurementId: "G-6FQNVDQVSP",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

const container = document.getElementById("adminPosts");

function isPermissionError(error) {
  return (
    error?.code === "permission-denied" ||
    /permission/i.test(error?.message || "")
  );
}

async function loadPosts() {
  container.innerHTML = "";

  try {
    const q = query(collection(db, "posts"), where("status", "==", "pending"));

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      container.innerHTML = `<div class="card"><p>Không có bài nào đang chờ duyệt.</p></div>`;
      return;
    }

    snapshot.forEach((d) => {
      const data = d.data();

      const div = document.createElement("div");
      div.className = "card";

      div.innerHTML = `
            <p>${data.content}</p>
            <div class="actions">
              <button class="approve" onclick="approve('${d.id}')">Duyệt</button>
              <button class="reject" onclick="reject('${d.id}')">Từ chối</button>
              <button class="delete" onclick="deletePost('${d.id}')">Xoá</button>
            </div>
          `;

      container.appendChild(div);
    });
  } catch (error) {
    console.error("Error loading posts:", error);
    container.innerHTML = `<div class="card"><p>Lỗi khi tải bài đăng: ${error.message}</p></div>`;
  }
}

window.approve = async (id) => {
  try {
    await updateDoc(doc(db, "posts", id), {
      status: "approved",
    });
    await loadPosts();
  } catch (error) {
    console.error("Error approving post:", error);
    alert("Lỗi khi duyệt bài: " + error.message);
  }
};

window.reject = async (id) => {
  try {
    await updateDoc(doc(db, "posts", id), {
      status: "rejected",
    });
    await loadPosts();
  } catch (error) {
    console.error("Error rejecting post:", error);
    alert("Lỗi khi từ chối bài: " + error.message);
  }
};

window.deletePost = async (id) => {
  try {
    await deleteDoc(doc(db, "posts", id));
    await loadPosts();
  } catch (error) {
    console.error("Error deleting post:", error);
    alert("Lỗi khi xóa bài: " + error.message);
  }
};

loadPosts();
