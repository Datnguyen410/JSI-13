import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-analytics.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

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

function getCurrentSessionUser() {
  const session = localStorage.getItem("confess_current_user");
  return session ? JSON.parse(session) : null;//kiểm tra người dùng, nếu có thì trả về thông tin người dùng đó dưới dạng đối tượng JavaScript, nếu không có thì trả về null.
}

function getQueryParam(param) {
  return new URLSearchParams(window.location.search).get(param);
}

function formatTimestamp(createdAt) { //định dạng thời gian hiển thị thời gian
  if (!createdAt) return "";
  const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return date.toLocaleString("vi-VN", {
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderPostCard(post) {
  const div = document.createElement("div");
  div.className = "post-item";
  div.innerHTML = `
    <div class="post-meta"><strong>${post.authorName || "Người dùng ẩn danh"}</strong> · ${formatTimestamp(post.createdAt)}</div>
    <p class="post-content">${post.content}</p>
    <div class="actions">
      <span>❤️ ${post.likes || 0}</span>
      <span>🔄 ${post.reposts || 0}</span>
    </div>
  `;
  return div;
}

async function loadUserProfile() {
  const currentUser = getCurrentSessionUser();
  const requestedUserId = getQueryParam("userId");
  const userId = requestedUserId || currentUser?.id;

  if (!userId) {
    window.location.href = "./login.html";
    return;
  }

  const profileSummary = document.getElementById("profileSummary");
  const postsList = document.getElementById("postsList");
  const repostList = document.getElementById("repostList");

  profileSummary.innerHTML = "<p>Đang tải hồ sơ...</p>";
  postsList.innerHTML = "";
  repostList.innerHTML = "";

  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) {
      profileSummary.innerHTML = `<div class="card"><p>Không tìm thấy người dùng.</p></div>`;
      return;
    }

    const user = { id: userDoc.id, ...userDoc.data() };

    const authoredQuery = query(
      collection(db, "posts"),
      where("authorId", "==", user.id),
    );
    const authoredSnapshot = await getDocs(authoredQuery);

    // Fetch all posts and filter reposted posts locally to avoid index issues.
    const allPostsSnapshot = await getDocs(collection(db, "posts"));

    let totalLikes = 0;
    const authoredPosts = [];
    authoredSnapshot.forEach((docItem) => {
      const post = { id: docItem.id, ...docItem.data() };
      totalLikes += post.likes || 0;
      authoredPosts.push(post);
    });

    const repostedPosts = [];
    allPostsSnapshot.forEach((docItem) => {
      const post = { id: docItem.id, ...docItem.data() };
      if (Array.isArray(post.repostedBy) && post.repostedBy.includes(user.id)) {
        repostedPosts.push(post);
      }
    });

    repostedPosts.sort((a, b) => {
      const aTime = a.createdAt?.toMillis
        ? a.createdAt.toMillis()
        : a.createdAt || 0;
      const bTime = b.createdAt?.toMillis
        ? b.createdAt.toMillis()
        : b.createdAt || 0;
      return bTime - aTime;
    });

    authoredPosts.sort((a, b) => {
      const aTime = a.createdAt?.toMillis
        ? a.createdAt.toMillis()
        : a.createdAt || 0;
      const bTime = b.createdAt?.toMillis
        ? b.createdAt.toMillis()
        : b.createdAt || 0;
      return bTime - aTime;
    });

    profileSummary.innerHTML = `
      <div class="profile-card">
        <h2>${user.name || user.email || "Người dùng"}</h2>
        <p><strong>Số bài đăng:</strong> ${authoredPosts.length}</p>
        <p><strong>Số lượt like:</strong> ${totalLikes}</p>
        <p><strong>Số bài đã reup:</strong> ${repostedPosts.length}</p>
      </div>
    `;

    if (authoredPosts.length === 0) {
      postsList.innerHTML = `<div class="card"><p>Người dùng chưa đăng bài nào.</p></div>`;
    } else {
      authoredPosts.forEach((post) =>
        postsList.appendChild(renderPostCard(post)),
      );
    }

    if (repostedPosts.length === 0) {
      repostList.innerHTML = `<div class="card"><p>Người dùng chưa reup bài nào.</p></div>`;
    } else {
      repostedPosts.forEach((post) =>
        repostList.appendChild(renderPostCard(post)),
      );
    }
  } catch (error) {
    console.error("Error loading profile:", error);
    profileSummary.innerHTML = `<div class="card"><p>Không thể tải hồ sơ: ${error.message}</p></div>`;
  }
}

loadUserProfile();
