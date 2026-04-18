// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  query,
  orderBy,
  addDoc,
  deleteDoc,
  doc,
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
getAnalytics(app);
const db = getFirestore(app);

const adminPostList = document.getElementById("adminPostList");
const adminContentInput = document.getElementById("adminContent");
const adminPostButton = document.getElementById("adminPostButton");
const STORAGE_KEY = "confess_posts_demo";
let useFirestore = true;

function isPermissionError(error) {
  return (
    error?.code === "permission-denied" ||
    /permission/i.test(error?.message || "")
  );
}

function getLocalPosts() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveLocalPosts(posts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

function formatTimestamp(value) {
  if (!value) return "Không rõ";
  const time = value.toMillis ? value.toMillis() : value;
  return new Date(time).toLocaleString("vi-VN", {
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderStatus(status) {
  switch (status) {
    case "approved":
      return "Đã duyệt";
    case "rejected":
      return "Bị từ chối";
    case "pending":
      return "Chờ duyệt";
    default:
      return "Chưa rõ";
  }
}

async function loadAdminPosts() {
  adminPostList.innerHTML = "";

  if (useFirestore) {
    try {
      const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        adminPostList.innerHTML = `<div class="card"><p>Chưa có bài đăng nào.</p></div>`;
        return;
      }

      snapshot.forEach((docItem) => {
        const post = { id: docItem.id, ...docItem.data() };
        const createdAt = formatTimestamp(
          post.createdAt || post.createdAtMillis,
        );

        const div = document.createElement("div");
        div.className = "card";
        div.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
            <div>
              <p><strong>${post.authorName || "Người dùng ẩn danh"}</strong> · <span style="color:#94a3b8;">${createdAt}</span></p>
              <p>${post.content}</p>
              <p style="font-size:12px; color:#94a3b8; margin-top:8px;">Trạng thái: ${renderStatus(post.status)}</p>
            </div>
            <div>
              <button class="notify" onclick="sendAdminNotification('${post.id}')">Thông báo</button>
              <button class="delete" onclick="deleteAdminPost('${post.id}')">Xoá</button>
            </div>
          </div>
        `;
        adminPostList.appendChild(div);
      });
      return;
    } catch (error) {
      if (isPermissionError(error)) {
        useFirestore = false;
        console.warn(
          "Switching to local fallback because of Firestore permissions.",
          error,
        );
      } else {
        throw error;
      }
    }
  }

  const posts = getLocalPosts().sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
  );

  if (posts.length === 0) {
    adminPostList.innerHTML = `<div class="card"><p>Chưa có bài đăng nào.</p></div>`;
    return;
  }

  posts.forEach((post) => {
    const createdAt = formatTimestamp(post.createdAt);
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
        <div>
          <p><strong>${post.authorName || "Người dùng ẩn danh"}</strong> · <span style="color:#94a3b8;">${createdAt}</span></p>
          <p>${post.content}</p>
          <p style="font-size:12px; color:#94a3b8; margin-top:8px;">Trạng thái: ${renderStatus(post.status)}</p>
        </div>
        <div>
          <button class="notify" onclick="sendAdminNotification('${post.id}')">Thông báo</button>
          <button class="delete" onclick="deleteAdminPost('${post.id}')">Xoá</button>
        </div>
      </div>
    `;
    adminPostList.appendChild(div);
  });
}

async function addLocalPost(content) {
  const posts = getLocalPosts();
  posts.unshift({
    id: Date.now().toString(),
    content,
    authorName: "Admin",
    authorId: "admin",
    status: "approved",
    createdAt: Date.now(),
    likes: 0,
    reposts: 0,
    comments: [],
    reportCount: 0,
  });
  saveLocalPosts(posts);
}

async function deleteLocalPost(id) {
  const posts = getLocalPosts().filter((item) => item.id !== id);
  saveLocalPosts(posts);
}

const NOTIFICATIONS_KEY = "confess_notifications";

function getNotifications() {
  const raw = localStorage.getItem(NOTIFICATIONS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveNotifications(notifications) {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

async function getPostById(id) {
  if (useFirestore) {
    try {
      const snap = await getDoc(doc(db, "posts", id));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    } catch (error) {
      if (isPermissionError(error)) {
        useFirestore = false;
        console.warn(
          "Switching to local fallback because of Firestore permissions.",
          error,
        );
      } else {
        throw error;
      }
    }
  }

  return getLocalPosts().find((item) => item.id === id) || null;
}

window.sendAdminNotification = async (postId) => {
  const post = await getPostById(postId);
  if (!post) {
    alert("Không tìm thấy bài đăng.");
    return;
  }

  const message = prompt(
    "Nhập nội dung thông báo cho bài này:",
    "Admin xin thông báo về bài viết của bạn...",
  );

  if (!message || !message.trim()) {
    return;
  }

  const notification = {
    postId,
    userId: post.authorId || post.userId || "unknown",
    authorName: post.authorName || "Người dùng ẩn danh",
    content: post.content,
    message: message.trim(),
    timestamp: Date.now(),
    read: false,
  };

  if (useFirestore) {
    try {
      await addDoc(collection(db, "notifications"), {
        ...notification,
        timestamp: serverTimestamp(),
      });
      alert("Đã gửi thông báo đến bài đăng.");
      return;
    } catch (error) {
      if (isPermissionError(error)) {
        useFirestore = false;
        console.warn(
          "Switching to local fallback because of Firestore permissions.",
          error,
        );
      } else {
        throw error;
      }
    }
  }

  const notifications = getNotifications();
  notifications.push(notification);
  saveNotifications(notifications);
  alert("Đã lưu thông báo admin vào bộ nhớ local.");
};

adminPostButton.addEventListener("click", async () => {
  const content = adminContentInput.value.trim();
  if (!content) {
    alert("Vui lòng nhập nội dung bài đăng.");
    return;
  }

  if (useFirestore) {
    try {
      await addDoc(collection(db, "posts"), {
        content,
        authorId: "admin",
        authorName: "Admin",
        status: "approved",
        createdAt: serverTimestamp(),
        likes: 0,
        reposts: 0,
        comments: [],
        reportCount: 0,
      });
      adminContentInput.value = "";
      alert("Đã đăng bài dưới tên Admin.");
      await loadAdminPosts();
      return;
    } catch (error) {
      if (isPermissionError(error)) {
        useFirestore = false;
        console.warn(
          "Switching to local fallback because of Firestore permissions.",
          error,
        );
      } else {
        throw error;
      }
    }
  }

  await addLocalPost(content);
  adminContentInput.value = "";
  alert("Đã đăng bài dưới tên Admin (demo local). ");
  await loadAdminPosts();
});

window.deleteAdminPost = async (id) => {
  if (!confirm("Bạn muốn xóa bài đăng này?")) return;

  if (useFirestore) {
    try {
      await deleteDoc(doc(db, "posts", id));
      await loadAdminPosts();
      return;
    } catch (error) {
      if (isPermissionError(error)) {
        useFirestore = false;
        console.warn(
          "Switching to local fallback because of Firestore permissions.",
          error,
        );
      } else {
        throw error;
      }
    }
  }

  await deleteLocalPost(id);
  await loadAdminPosts();
};

window.addEventListener("DOMContentLoaded", () => {
  loadAdminPosts();
});
