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
const usersContainer = document.getElementById("usersContainer");
const navLinks = document.querySelectorAll(".nav-link");

function isPermissionError(error) {
  return (
    error?.code === "permission-denied" ||
    /permission/i.test(error?.message || "")
  );
}

async function loadStats() {
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    document.getElementById("userCount").textContent = usersSnapshot.size;

    const pendingQuery = query(
      collection(db, "posts"),
      where("status", "==", "pending"),
    );
    const pendingSnapshot = await getDocs(pendingQuery);
    document.getElementById("pendingCount").textContent = pendingSnapshot.size;

    const approvedQuery = query(
      collection(db, "posts"),
      where("status", "==", "approved"),
    );
    const approvedSnapshot = await getDocs(approvedQuery);
    document.getElementById("approvedCount").textContent =
      approvedSnapshot.size;
  } catch (error) {
    console.error("Error loading stats:", error);
  }
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
    await loadStats();
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
    await loadStats();
  } catch (error) {
    console.error("Error rejecting post:", error);
    alert("Lỗi khi từ chối bài: " + error.message);
  }
};

window.deletePost = async (id) => {
  try {
    await deleteDoc(doc(db, "posts", id));
    await loadPosts();
    await loadStats();
  } catch (error) {
    console.error("Error deleting post:", error);
    alert("Lỗi khi xóa bài: " + error.message);
  }
};

async function loadUsers() {
  usersContainer.innerHTML = "";

  try {
    const usersSnapshot = await getDocs(collection(db, "users"));

    if (usersSnapshot.empty) {
      usersContainer.innerHTML = `<div class="card"><p>Không có người dùng nào.</p></div>`;
      return;
    }

    const usersData = [];

    for (const userDoc of usersSnapshot.docs) {
      const user = { id: userDoc.id, ...userDoc.data() };

      // Count posts
      const postsQuery = query(
        collection(db, "posts"),
        where("authorId", "==", user.id),
      );
      const postsSnapshot = await getDocs(postsQuery);
      const postCount = postsSnapshot.size;

      // Calculate interactions: sum of likes, reposts, comments
      let totalInteractions = 0;
      postsSnapshot.forEach((postDoc) => {
        const post = postDoc.data();
        totalInteractions +=
          (post.likes || 0) +
          (post.reposts || 0) +
          (post.comments ? post.comments.length : 0);
      });

      usersData.push({
        name: user.name || user.email,
        postCount,
        interactions: totalInteractions,
      });
    }

    usersData.forEach((user) => {
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <p><strong>Tên:</strong> ${user.name}</p>
        <p><strong>Số bài đã đăng:</strong> ${user.postCount}</p>
        <p><strong>Số lượt tương tác:</strong> ${user.interactions}</p>
      `;
      usersContainer.appendChild(div);
    });
  } catch (error) {
    console.error("Error loading users:", error);
    usersContainer.innerHTML = `<div class="card"><p>Lỗi khi tải người dùng: ${error.message}</p></div>`;
  }
}
loadStats();
loadPosts();

// Navigation
navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    navLinks.forEach((l) => l.classList.remove("active"));
    link.classList.add("active");

    const sections = document.querySelectorAll(".content-section");
    sections.forEach((s) => (s.style.display = "none"));
    document.querySelector(".stats-grid").style.display = "none";

    if (link.textContent.includes("Dashboard")) {
      document.querySelector(".stats-grid").style.display = "grid";
      document.querySelector(".content-section").style.display = "block";
    } else if (link.textContent.includes("Users")) {
      document.getElementById("usersSection").style.display = "block";
      loadUsers();
    } else if (link.textContent.includes("Posts")) {
      window.location.href = "./admin-posts.html";
    }
  });
});
