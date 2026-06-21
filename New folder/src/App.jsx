import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import useAuthStore from './store/authStore'
import useUIStore from './store/uiStore'
import useOnlineStore from './store/onlineStore'
import useWishlistStore from './store/wishlistStore'
import useRatingStore from './store/ratingStore'
import useWalletStore from './store/walletStore'
import { connectSocket, disconnectSocket } from './lib/socket'
import api from './lib/api'

// Layouts
import MainLayout from './components/layouts/MainLayout'
import AuthLayout from './components/layouts/AuthLayout'
import AdminLayout from './components/layouts/AdminLayout'

// Pages
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PostDetailPage from './pages/PostDetailPage'
import CreatePostPage from './pages/CreatePostPage'
import EditPostPage from './pages/EditPostPage'
import ProfilePage from './pages/ProfilePage'
import CategoryPage from './pages/CategoryPage'
import ForumPage from './pages/ForumPage'
import ForumDetailPage from './pages/ForumDetailPage'
import MyPostsPage from './pages/MyPostsPage'
import SearchPage from './pages/SearchPage'
import InboxPage from './pages/InboxPage'
import WishlistPage from './pages/WishlistPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminBanners from './pages/admin/AdminBanners'
import AdminPosts from './pages/admin/AdminPosts'
import AdminUsers from './pages/admin/AdminUsers'
import AdminReports from './pages/admin/AdminReports'
import AdminCategories from './pages/admin/AdminCategories'
import AdminMarketplace from './pages/admin/AdminMarketplace'
import AdminDisputes from './pages/admin/AdminDisputes'
import AdminAuditLogs from './pages/admin/AdminAuditLogs'
import WalletPage from './pages/WalletPage'
import OrdersPage from './pages/OrdersPage'
import OrderDetailPage from './pages/OrderDetailPage'
import NotFoundPage from './pages/NotFoundPage'

const ProtectedRoute = ({ children, roles = [] }) => {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }
  return children
}

const GuestRoute = ({ children }) => {
  const { user } = useAuthStore()
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { user, token } = useAuthStore()
  const { darkMode } = useUIStore()

  useEffect(() => {
    useAuthStore.getState().validateSession()
  }, [])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      document.body.classList.add('dark')
      document.body.style.backgroundColor = '#000000'
      document.body.style.color = '#f5f5f7'
    } else {
      document.documentElement.classList.remove('dark')
      document.body.classList.remove('dark')
      document.body.style.backgroundColor = '#ffffff'
      document.body.style.color = '#1d1d1f'
    }
  }, [darkMode])

  useEffect(() => {
    if (user && token) {
      useWishlistStore.getState().fetchIds()
      useWalletStore.getState().fetchWallet()
    } else {
      useWishlistStore.getState().reset()
      useWalletStore.getState().reset()
    }
  }, [user, token])

  useEffect(() => {
    if (user && token) {
      const socket = connectSocket(token)
      const { setOnline, setOffline, setInitialOnline } = useOnlineStore.getState()
      const { setSellerRating, clear: clearRatings } = useRatingStore.getState()

      socket.on('connect', () => {
        api.get('/auth/online-users')
          .then(({ data }) => setInitialOnline(data.onlineIds))
          .catch(() => {})
      })

      socket.on('user:online', ({ userId }) => setOnline(userId))
      socket.on('user:offline', ({ userId }) => setOffline(userId))

      socket.on('rating:updated', (payload) => {
        setSellerRating(payload.userId, {
          rating: payload.rating,
          ratingCount: payload.ratingCount,
          breakdown: payload.breakdown,
        })
      })

      // Keep auth store totalSales in sync when the logged-in user marks a post sold
      socket.on('seller:stats-updated', ({ sellerId, totalSales }) => {
        const { user: currentUser, updateUser } = useAuthStore.getState()
        if (currentUser && currentUser._id?.toString() === sellerId) {
          updateUser({ totalSales })
        }
      })

      socket.on('wallet:updated', ({ userId }) => {
        const { user: currentUser } = useAuthStore.getState()
        if (currentUser && currentUser._id?.toString() === userId) {
          useWalletStore.getState().fetchWallet()
        }
      })

      // Real-time role promotion / demotion — update auth store so benefits apply instantly
      socket.on('user:role-updated', ({ userId, role, verified }) => {
        const { user: currentUser, updateUser } = useAuthStore.getState()
        if (currentUser && currentUser._id?.toString() === userId) {
          updateUser({ role, verified })
        }
      })

      return () => {
        socket.off('connect')
        socket.off('user:online')
        socket.off('user:offline')
        socket.off('rating:updated')
        socket.off('seller:stats-updated')
        socket.off('wallet:updated')
        socket.off('user:role-updated')
      }
    } else {
      useRatingStore.getState().clear()
      disconnectSocket()
    }
  }, [user, token])

  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '11px',
            background: darkMode ? '#1c1c1e' : '#ffffff',
            color: darkMode ? '#f5f5f7' : '#1d1d1f',
            fontSize: '15px',
            fontWeight: '400',
            letterSpacing: '-0.224px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.06)',
            border: darkMode ? '1px solid #3a3a3c' : '1px solid #e0e0e0',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
          },
        }}
      />
      <AppRoutes />
    </BrowserRouter>
  )
}

// Inner component — routes stay stable, no key needed on Routes itself
function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['admin', 'moderator', 'supervisor']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="banners" element={<AdminBanners />} />
        <Route path="posts" element={<AdminPosts />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="marketplace" element={<AdminMarketplace />} />
        <Route path="disputes" element={<AdminDisputes />} />
        <Route path="audit-logs" element={<AdminAuditLogs />} />
      </Route>

      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/post/:id" element={<PostDetailPage />} />
        <Route path="/category/:slug" element={<CategoryPage />} />
        <Route path="/forum" element={<ForumPage />} />
        <Route path="/forum/:id" element={<ForumDetailPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/profile/:username" element={<ProfilePage />} />
        <Route path="/create-post" element={<ProtectedRoute><CreatePostPage /></ProtectedRoute>} />
        <Route path="/edit-post/:id" element={<ProtectedRoute><EditPostPage /></ProtectedRoute>} />
        <Route path="/my-posts" element={<ProtectedRoute><MyPostsPage /></ProtectedRoute>} />
        <Route path="/wishlist" element={<ProtectedRoute><WishlistPage /></ProtectedRoute>} />
        <Route path="/inbox" element={<ProtectedRoute><InboxPage /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
        <Route path="/orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
