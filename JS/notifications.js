import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  doc,
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
const analytics = getAnalytics(app);
const db = getFirestore(app);

const NOTIFICATIONS_KEY = "confess_notifications";
const USER_ID_KEY = "confess_user_id";
let currentFilter = "all";
const currentUserId = getOrCreateUserId();

function isPermissionError(error) {
  return (
    error?.code === "permission-denied" ||
    /permission/i.test(error?.message || "")
  );
}

function isFirestoreIndexError(error) {
  return /requires an index/i.test(error?.message || "");
}

function getLocalNotifications() {
  const raw = localStorage.getItem(NOTIFICATIONS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function getLocalNotificationsForUser(userId) {
  return getLocalNotifications().filter((notif) => notif.userId === userId);
}

function saveLocalNotification(notification) {
  const notifications = getLocalNotifications();
  notifications.push(notification);
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

function updateLocalNotification(notificationId, updates) {
  const notifications = getLocalNotifications().map((notif) =>
    notif.id === notificationId ? { ...notif, ...updates } : notif,
  );
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

function deleteLocalNotification(notificationId) {
  const notifications = getLocalNotifications().filter(
    (notif) => notif.id !== notificationId,
  );
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

function getOrCreateUserId() {
  const currentUser = localStorage.getItem("confess_current_user");
  if (currentUser) {
    try {
      const user = JSON.parse(currentUser);
      if (user?.id) {
        return user.id;
      }
    } catch (error) {
      console.warn("Invalid current user session", error);
    }
  }

  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId =
      "user_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

async function getUserNotifications() {
  try {
    const notificationsQuery = query(
      collection(db, "notifications"),
      where("userId", "==", currentUserId),
    );
    const snapshot = await getDocs(notificationsQuery);
    const notifications = [];
    snapshot.forEach((docItem) => {
      const notification = docItem.data();
      notification.id = docItem.id;
      notifications.push(notification);
    });

    const localNotifications = getLocalNotificationsForUser(currentUserId);
    return [...notifications, ...localNotifications].sort((a, b) => {
      const aTime = a.timestamp?.seconds
        ? a.timestamp.seconds * 1000
        : a.timestamp || 0;
      const bTime = b.timestamp?.seconds
        ? b.timestamp.seconds * 1000
        : b.timestamp || 0;
      return bTime - aTime;
    });
  } catch (error) {
    if (isPermissionError(error) || isFirestoreIndexError(error)) {
      console.warn(
        "Falling back to local notifications due to Firestore query issue",
        error,
      );
      return getLocalNotificationsForUser(currentUserId);
    }
    throw error;
  }
}

function getFilteredNotifications(notifications, filter) {
  if (filter === "unread") {
    return notifications.filter((n) => !n.read);
  } else if (filter === "read") {
    return notifications.filter((n) => n.read);
  }
  return notifications;
}

async function renderNotifications() {
  const container = document.getElementById("notificationsList");
  container.innerHTML = "";

  try {
    const notifications = await getFilteredNotifications(
      await getUserNotifications(),
      currentFilter,
    );

    if (notifications.length === 0) {
      container.innerHTML = `
              <div class="empty-state">
                <p>📭 Không có thông báo nào</p>
              </div>
            `;
      return;
    }

    notifications.forEach((notif) => {
      const date = new Date(
        notif.timestamp?.seconds
          ? notif.timestamp.seconds * 1000
          : notif.timestamp || 0,
      );
      const timeStr = date.toLocaleString("vi-VN");
      const cardClass = notif.read
        ? "notification-card read"
        : "notification-card";

      const card = document.createElement("div");
      card.className = cardClass;
      card.innerHTML = `
              <div class="notification-header">
                <span class="notification-title">📬 Thông báo từ Admin</span>
                <span class="notification-time">${timeStr}</span>
              </div>
              <div class="notification-message">
                ${notif.message}
              </div>
              <div class="notification-post-preview">
                <strong>Bài viết:</strong> "${notif.content?.substring(0, 60) || ""}${notif.content?.length > 60 ? "..." : ""}"
              </div>
              <div class="notification-actions">
                ${
                  !notif.read
                    ? `<button class="btn btn-mark-read" onclick="markAsRead('${notif.id}')">
                         ✓ Đánh dấu đã đọc
                       </button>`
                    : `<button class="btn btn-mark-read" style="opacity: 0.5;" disabled>
                         ✓ Đã đọc
                       </button>`
                }
                <button class="btn btn-delete" onclick="deleteNotification('${notif.id}')">
                  Xóa
                </button>
              </div>
            `;
      container.appendChild(card);
    });
  } catch (error) {
    console.error("Failed to load notifications", error);
    container.innerHTML = `<div class="empty-state"><p>Không thể tải thông báo.</p></div>`;
  }
}

window.markAsRead = async (notificationId) => {
  try {
    await updateDoc(doc(db, "notifications", notificationId), {
      read: true,
    });
  } catch (error) {
    console.warn(
      "Firestore markAsRead failed, using localStorage fallback",
      error,
    );
    updateLocalNotification(notificationId, { read: true });
  }
  await renderNotifications();
};

window.deleteNotification = async (notificationId) => {
  if (!confirm("Bạn có chắc muốn xóa thông báo này?")) {
    return;
  }

  try {
    await deleteDoc(doc(db, "notifications", notificationId));
  } catch (error) {
    console.warn(
      "Firestore deleteNotification failed, using localStorage fallback",
      error,
    );
    deleteLocalNotification(notificationId);
  }
  await renderNotifications();
};

window.filterNotifications = async (filter, event) => {
  currentFilter = filter;

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  event?.target?.classList.add("active");

  await renderNotifications();
};

window.addEventListener("DOMContentLoaded", renderNotifications);
