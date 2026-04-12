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
  serverTimestamp,
  updateDoc,
  doc,
  arrayUnion,
  increment,
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
let approvedPostsCache = [];

function getLoggedInUser() {
  const session = localStorage.getItem("confess_current_user");
  return session ? JSON.parse(session) : null;
}

const loggedInUser = getLoggedInUser();
const currentUserId = loggedInUser?.id || "anonymous";
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

function findCachedPost(postId) {
  return approvedPostsCache.find((post) => post.id === postId) || null;
}

async function loadApprovedPosts() {
  postList.innerHTML = "";

  try {
    const approvedQuery = query(
      collection(db, "posts"),
      where("status", "==", "approved"),
    );

    const snapshot = await getDocs(approvedQuery);
    if (snapshot.empty) {
      postList.innerHTML = `<p>Chưa có bài nào được duyệt.</p>`;
      return;
    }

    approvedPostsCache = snapshot.docs
      .map((docItem) => ({ id: docItem.id, ...docItem.data() }))
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis
          ? a.createdAt.toMillis()
          : a.createdAt || 0;
        const bTime = b.createdAt?.toMillis
          ? b.createdAt.toMillis()
          : b.createdAt || 0;
        return bTime - aTime;
      });

    approvedPostsCache.forEach((data) => {
      const postItem = document.createElement("div");
      postItem.className = "post-item";
      postItem.innerHTML = `
            <p class="post-content">${data.content}</p>
            <div class="actions">
              <span class="action-btn like-btn" onclick="toggleLike('${data.id}')">❤️ ${data.likes || 0}</span>
              <span class="action-btn comment-btn" onclick="openCommentForm('${data.id}')">💬 ${(data.comments || []).length}</span>
              <span class="action-btn repost-btn" onclick="toggleRepost('${data.id}')">🔄 ${data.reposts || 0}</span>
              <span class="action-btn report-btn" onclick="reportPost('${data.id}')">⚠️ Report</span>
            </div>
            <div class="comments-section" id="comments-${data.id}" style="display: none;">
              <div class="comments-list"></div>
              <div class="comment-input">
                <input type="text" class="comment-field" placeholder="Viết comment..." id="input-${data.id}" />
                <button onclick="addComment('${data.id}')">Gửi</button>
              </div>
            </div>
          `;
      postList.appendChild(postItem);
    });
  } catch (error) {
    if (isPermissionError(error)) {
      console.error("Firestore permission error:", error);
      postList.innerHTML = `<p>Không thể tải bài do lỗi quyền truy cập Firestore.</p>`;
    } else {
      throw error;
    }
  }
}

postButton.addEventListener("click", async () => {
  const content = postInput.value.trim();
  if (!content) {
    alert("Vui lòng nhập nội dung trước khi đăng.");
    return;
  }

  try {
    await addDoc(collection(db, "posts"), buildPostPayload(content));
    postInput.value = "";
    alert("Bài đăng của bạn đã được gửi lên, chờ admin duyệt.");
  } catch (error) {
    if (isPermissionError(error)) {
      console.error("Firestore permission error:", error);
      alert("Hiện tại không thể gửi bài do lỗi Firestore.");
    } else {
      throw error;
    }
  }
});

window.toggleLike = async (postId) => {
  try {
    await updateDoc(doc(db, "posts", postId), {
      likes: increment(1),
    });
    await loadApprovedPosts();
  } catch (error) {
    console.error("Like failed:", error);
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

window.addComment = async (postId) => {
  const input = document.getElementById(`input-${postId}`);
  const commentText = input?.value.trim();
  if (!commentText) {
    alert("Vui lòng nhập comment.");
    return;
  }

  try {
    await updateDoc(doc(db, "posts", postId), {
      comments: arrayUnion({
        id: Date.now().toString(),
        text: commentText,
        reported: false,
        createdAt: serverTimestamp(),
        authorId: currentUserId,
      }),
    });
    if (input) input.value = "";
    await loadApprovedPosts();
  } catch (error) {
    console.error("Comment failed:", error);
    alert("Không thể thêm comment vì lỗi Firestore.");
  }
};

window.renderComments = (postId) => {
  const post = findCachedPost(postId);
  const listContainer = document.querySelector(
    `#comments-${postId} .comments-list`,
  );
  if (!listContainer || !post) return;

  const comments = Array.isArray(post.comments) ? post.comments : [];

  listContainer.innerHTML = "";
  if (comments.length === 0) {
    listContainer.innerHTML = `<p style="font-size: 12px; color: #999;">Chưa có comment nào.</p>`;
    return;
  }

  comments.forEach((comment) => {
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
  alert("Tính năng report sẽ được cập nhật sau.");
};

window.toggleRepost = async (postId) => {
  try {
    await updateDoc(doc(db, "posts", postId), {
      reposts: increment(1),
    });
    await loadApprovedPosts();
  } catch (error) {
    console.error("Repost failed:", error);
  }
};

window.reportPost = (postId) => {
  if (confirm("Bạn chắc chắn muốn report bài này không?")) {
    alert("Cảm ơn. Bài này sẽ được kiểm duyệt.");
  }
};

window.addEventListener("DOMContentLoaded", () => {
  loadApprovedPosts();
});
