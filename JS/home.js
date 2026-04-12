// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

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

// Firestore schema:
// Collection: posts
// Document fields:
//   content: string
//   authorId: string
//   authorName: string
//   status: string (pending | approved | rejected)
//   createdAt: timestamp
//   likes: number
//   reposts: number
//   comments: array
//   reportCount: number

const postInput = document.getElementById("postInput");
const postButton = document.getElementById("postButton");
const postList = document.querySelector(".post-list");
const notificationBox = document.getElementById("notificationBox");
const STORAGE_KEY = "confess_posts_demo";
const NOTIFICATIONS_KEY = "confess_notifications";
const USER_ID_KEY = "confess_user_id";
let useFirestore = true;

// 👤 Hệ thống userId: Tạo userId độc nhất cho mỗi user
function getOrCreateUserId() {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId =
      "user_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

function getLoggedInUser() {
  const session = localStorage.getItem("confess_current_user");
  return session ? JSON.parse(session) : null;
}

const loggedInUser = getLoggedInUser();
const currentUserId = loggedInUser?.id || getOrCreateUserId();
const currentUserName = loggedInUser?.name || "Người dùng ẩn danh";

function buildPostPayload(content) {
  return {
    content,
    authorId: currentUserId,
    authorName: currentUserName,
    status: "pending",
    createdAt: serverTimestamp(),
    likes: 0,
    reposts: 0,
    comments: [],
    reportCount: 0,
  };
}

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

async function syncLocalPendingPostsToFirestore() {
  if (!useFirestore) return;

  const posts = getLocalPosts();
  const pendingLocal = posts.filter(
    (post) => post.status === "pending" && post._localPending,
  );
  if (pendingLocal.length === 0) return;

  const remaining = [];
  for (const post of pendingLocal) {
    try {
      await addDoc(collection(db, "posts"), {
        content: post.content,
        authorId: post.authorId || currentUserId,
        authorName: post.authorName || currentUserName,
        status: "pending",
        createdAt: serverTimestamp(),
        likes: post.likes || 0,
        reposts: post.reposts || 0,
        comments: post.comments || [],
        reportCount: post.reportCount || 0,
      });
    } catch (error) {
      if (isPermissionError(error)) {
        useFirestore = false;
        remaining.push(post);
      } else {
        remaining.push(post);
      }
    }
  }

  const syncedPosts = posts.filter(
    (post) => !(post.status === "pending" && post._localPending),
  );
  saveLocalPosts(syncedPosts.concat(remaining));
}

// 🔔 Hàm load và hiển thị thông báo từ admin
function loadNotifications() {
  const raw = localStorage.getItem(NOTIFICATIONS_KEY);
  const notifications = raw ? JSON.parse(raw) : [];

  notificationBox.innerHTML = "";

  // 👤 Lọc thông báo của user hiện tại và chưa đọc
  const unreadNotifications = notifications.filter(
    (n) => !n.read && n.userId === currentUserId,
  );

  if (unreadNotifications.length === 0) {
    return;
  }

  unreadNotifications.forEach((notification) => {
    const notifEl = document.createElement("div");
    notifEl.className = "notification-alert";
    notifEl.innerHTML = `
            <div class="notification-content">
              <strong>📬 Thông báo từ Admin</strong>
              <p>${notification.message}</p>
              <small style="color: #999;">Bài: "${notification.content.substring(0, 40)}..."</small>
            </div>
            <button class="notification-close" onclick="markNotificationAsRead('${notification.id}')">✕</button>
          `;
    notificationBox.appendChild(notifEl);
  });
}

// Hàm đánh dấu thông báo là đã đọc
window.markNotificationAsRead = (notificationId) => {
  const raw = localStorage.getItem(NOTIFICATIONS_KEY);
  const notifications = raw ? JSON.parse(raw) : [];
  const notification = notifications.find((n) => n.id === notificationId);
  if (notification) {
    notification.read = true;
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    loadNotifications();
  }
};

async function loadApprovedPosts() {
  postList.innerHTML = "";

  if (useFirestore) {
    try {
      const approvedQuery = query(
        collection(db, "posts"),
        where("status", "==", "approved"),
        orderBy("createdAt", "desc"),
      );

      const snapshot = await getDocs(approvedQuery);

      if (snapshot.empty) {
        postList.innerHTML = `<p>Chưa có bài nào được duyệt.</p>`;
        return;
      }

      snapshot.forEach((docItem) => {
        const data = docItem.data();
        const postItem = document.createElement("div");
        postItem.className = "post-item";
        postItem.textContent = data.content;
        postList.appendChild(postItem);
      });
      return;
    } catch (error) {
      if (isPermissionError(error)) {
        useFirestore = false;
        console.warn(
          "Switching to demo fallback because of Firestore permissions.",
          error,
        );
      } else {
        throw error;
      }
    }
  }

  const posts = getLocalPosts()
    .filter((post) => post.status === "approved")
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (posts.length === 0) {
    postList.innerHTML = `<p>Chưa có bài nào được duyệt.</p>`;
    return;
  }

  posts.forEach((post) => {
    const postItem = document.createElement("div");
    postItem.className = "post-item";
    postItem.innerHTML = `
            <p class="post-content">${post.content}</p>
            <div class="actions">
              <span class="action-btn like-btn" onclick="toggleLike('${post.id}')">❤️ ${post.likes || 0}</span>
              <span class="action-btn comment-btn" onclick="openCommentForm('${post.id}')">💬 ${(post.comments || []).length}</span>
              <span class="action-btn repost-btn" onclick="toggleRepost('${post.id}')">🔄 ${post.reposts || 0}</span>
              <span class="action-btn report-btn" onclick="reportPost('${post.id}')">⚠️ Report</span>
            </div>
            <div class="comments-section" id="comments-${post.id}" style="display: none;">
              <div class="comments-list"></div>
              <div class="comment-input">
                <input type="text" class="comment-field" placeholder="Viết comment..." id="input-${post.id}" />
                <button onclick="addComment('${post.id}')">Gửi</button>
              </div>
            </div>
          `;
    postList.appendChild(postItem);
  });
}

postButton.addEventListener("click", async () => {
  const content = postInput.value.trim();
  if (!content) {
    alert("Vui lòng nhập nội dung trước khi đăng.");
    return;
  }

  if (useFirestore) {
    try {
      await addDoc(collection(db, "posts"), buildPostPayload(content));
      postInput.value = "";
      alert("Bài đăng của bạn đã được gửi lên, chờ admin duyệt.");
      return;
    } catch (error) {
      if (isPermissionError(error)) {
        useFirestore = false;
        console.warn(
          "Switching to demo fallback because of Firestore permissions.",
          error,
        );
      } else {
        throw error;
      }
    }
  }

  const posts = getLocalPosts();
  posts.push({
    id: Date.now().toString(),
    userId: currentUserId,
    authorId: currentUserId,
    authorName: currentUserName,
    content,
    status: "pending",
    createdAt: Date.now(),
    likes: 0,
    comments: [],
    reposts: 0,
    reportCount: 0,
    _localPending: true,
  });
  saveLocalPosts(posts);
  postInput.value = "";
  alert(
    "Bài đăng của bạn đã được lưu ở chế độ demo. Admin có thể duyệt trong session này.",
  );
});

window.toggleLike = (postId) => {
  const posts = getLocalPosts();
  const post = posts.find((p) => p.id === postId);
  if (post) {
    post.likes = (post.likes || 0) + 1;
    saveLocalPosts(posts);
    loadApprovedPosts();
  }
};

window.openCommentForm = (postId) => {
  const section = document.getElementById(`comments-${postId}`);
  if (section) {
    section.style.display = section.style.display === "none" ? "block" : "none";
    if (section.style.display === "block") {
      renderComments(postId);
    }
  }
};

window.addComment = (postId) => {
  const input = document.getElementById(`input-${postId}`);
  const commentText = input?.value.trim();
  if (!commentText) {
    alert("Vui lòng nhập comment.");
    return;
  }

  const posts = getLocalPosts();
  const post = posts.find((p) => p.id === postId);
  if (post) {
    if (!post.comments) post.comments = [];
    post.comments.push({
      id: Date.now().toString(),
      text: commentText,
      reported: false,
    });
    saveLocalPosts(posts);
    if (input) input.value = "";
    renderComments(postId);
  }
};

window.renderComments = (postId) => {
  const posts = getLocalPosts();
  const post = posts.find((p) => p.id === postId);
  const listContainer = document.querySelector(
    `#comments-${postId} .comments-list`,
  );
  if (!listContainer || !post) return;

  listContainer.innerHTML = "";
  if (!post.comments || post.comments.length === 0) {
    listContainer.innerHTML = `<p style="font-size: 12px; color: #999;">Chưa có comment nào.</p>`;
    return;
  }

  post.comments.forEach((comment) => {
    const commentEl = document.createElement("div");
    commentEl.className = "comment-item";
    commentEl.innerHTML = `
            <p>${comment.text}</p>
            <span class="comment-action" onclick="reportComment('${postId}', '${comment.id}')">🚫 Report</span>
          `;
    listContainer.appendChild(commentEl);
  });
};

window.reportComment = (postId, commentId) => {
  const posts = getLocalPosts();
  const post = posts.find((p) => p.id === postId);
  if (post && post.comments) {
    const comment = post.comments.find((c) => c.id === commentId);
    if (comment) {
      if (confirm("Bạn chắc chắn muốn report comment này?")) {
        post.comments = post.comments.filter((c) => c.id !== commentId);
        saveLocalPosts(posts);
        renderComments(postId);
      }
    }
  }
};

window.toggleRepost = (postId) => {
  const posts = getLocalPosts();
  const post = posts.find((p) => p.id === postId);
  if (post) {
    post.reposts = (post.reposts || 0) + 1;
    saveLocalPosts(posts);
    alert("Bạn đã repost bài này.");
    loadApprovedPosts();
  }
};

window.reportPost = (postId) => {
  if (confirm("Bạn chắc chắn muốn report bài này không?")) {
    alert("Cảm ơn. Bài này sẽ được kiểm duyệt.");
  }
};

window.addEventListener("DOMContentLoaded", async () => {
  loadNotifications();
  await syncLocalPendingPostsToFirestore();
  loadApprovedPosts();
});
